const { Term } = require('../models');
const { Op } = require('sequelize');

const getTerms = async (req, res) => {
  try {
    const where = {};
    if (req.user?.role === 'faculty') {
      where.status = { [Op.in]: ['active', 'upcoming'] };
    }

    const terms = await Term.findAll({
      where,
      order: [['year', 'DESC'], ['term_number', 'ASC']],
    });
    res.json(terms);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getTerm = async (req, res) => {
  try {
    const term = await Term.findByPk(req.params.id);
    if (!term) return res.status(404).json({ error: 'Term not found.' });
    res.json(term);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const createTerm = async (req, res) => {
  try {
    const { year, term_number, label, status, bidding_opens_at, bidding_closes_at } = req.body;
    if (!year || !term_number) {
      return res.status(400).json({ error: 'year and term_number are required.' });
    }

    if (status && !['upcoming', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid term status.' });
    }

    const term = await Term.create({
      year,
      term_number,
      label,
      status: status || 'upcoming',
      bidding_opens_at: bidding_opens_at || null,
      bidding_closes_at: bidding_closes_at || null,
    });
    res.status(201).json(term);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'A term for this year and number already exists.' });
    }
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateTerm = async (req, res) => {
  try {
    const term = await Term.findByPk(req.params.id);
    if (!term) return res.status(404).json({ error: 'Term not found.' });
    const { status, label, bidding_opens_at, bidding_closes_at } = req.body;

    if (status && !['upcoming', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid term status.' });
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (label !== undefined) updates.label = label;
    if (bidding_opens_at !== undefined) updates.bidding_opens_at = bidding_opens_at || null;
    if (bidding_closes_at !== undefined) updates.bidding_closes_at = bidding_closes_at || null;

    await term.update(updates);
    res.json(term);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getTerms, getTerm, createTerm, updateTerm, bootstrapTerms };

// ─── Auto-generate 3 default terms if none exist ─────────────────────────────
async function bootstrapTerms() {
  try {
    const count = await Term.count();
    if (count > 0) return; // already have terms, skip

    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    // Academic year: if we're in Jan-May, the academic year started last year
    const academicYear = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const nextYear = academicYear + 1;

    const termsToCreate = [
      {
        year: academicYear,
        term_number: 1,
        label: `${academicYear}-${String(nextYear).slice(2)} Term 1`,
        status: 'active',
      },
      {
        year: academicYear,
        term_number: 2,
        label: `${academicYear}-${String(nextYear).slice(2)} Term 2`,
        status: 'upcoming',
      },
      {
        year: academicYear,
        term_number: 3,
        label: `${academicYear}-${String(nextYear).slice(2)} Term 3`,
        status: 'upcoming',
      },
    ];

    for (const t of termsToCreate) {
      await Term.findOrCreate({ where: { year: t.year, term_number: t.term_number }, defaults: t });
    }

    console.log(`✅ Auto-created 3 default terms for ${academicYear}-${nextYear}`);
  } catch (err) {
    console.error('❌ Failed to bootstrap terms:', err.message);
  }
}

