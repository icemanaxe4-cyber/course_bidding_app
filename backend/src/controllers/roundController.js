const { sequelize, BiddingRound, Term, Program, Course } = require('../models');
const { processRound } = require('../services/allocationService');
const { Op } = require('sequelize');

// ─── GET /rounds ─────────────────────────────────────────────────────────────
const getRounds = async (req, res) => {
  try {
    const { programId, termId } = req.query;
    const where = {};
    if (req.user.role === 'student') {
      if (!req.user.program_id || !req.user.program) return res.json([]);
      where.program_id = req.user.program_id;
    } else if (programId) {
      where.program_id = programId;
    }
    if (termId) {
      where[Op.or] = [
        { term_id: termId },
        { covers_all_terms: true },
      ];
    }

    const rounds = await BiddingRound.findAll({
      where,
      include: [
        { model: Program, as: 'program', attributes: ['id', 'name', 'code'] },
        { model: Term, as: 'term', attributes: ['id', 'year', 'term_number', 'label'] },
      ],
      order: [['round_number', 'ASC']],
    });

    res.json(rounds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── POST /rounds ─────────────────────────────────────────────────────────────
const createRound = async (req, res) => {
  try {
    const { program_id, program_ids, term_id, round_number, opens_at, closes_at, notes, covers_all_terms } = req.body;
    const programIds = [...new Set((Array.isArray(program_ids) && program_ids.length ? program_ids : [program_id]).filter(Boolean))];

    if (programIds.length === 0 || !round_number || !opens_at || !closes_at) {
      return res.status(400).json({ error: 'program_id/program_ids, round_number, opens_at, closes_at are required.' });
    }

    const programs = await Program.findAll({ where: { id: { [Op.in]: programIds } } });
    if (programs.length !== programIds.length) return res.status(404).json({ error: 'One or more programs were not found.' });
    if (programs.some(program => !program.is_active)) {
      return res.status(400).json({ error: 'Cannot create a round for an inactive program.' });
    }

    // If term_id provided, verify it
    if (term_id) {
      const term = await Term.findByPk(term_id);
      if (!term) return res.status(404).json({ error: 'Term not found.' });
    }

    const coversAllTerms = covers_all_terms === undefined
      ? true
      : covers_all_terms === true || covers_all_terms === 'true';

    // Keep a term anchor for existing databases where term_id is NOT NULL.
    // All-term behavior still comes from covers_all_terms.
    let resolvedTermId = term_id || null;
    if (!resolvedTermId) {
      const activeTerm = await Term.findOne({ where: { status: 'active' }, order: [['term_number', 'ASC']] });
      resolvedTermId = activeTerm?.id || null;
    }

    if (!resolvedTermId) {
      return res.status(400).json({ error: 'Create or activate a term before creating a bidding round.' });
    }

    const createdRounds = await sequelize.transaction(async (transaction) => {
      const rounds = [];
      for (const nextProgramId of programIds) {
        const round = await BiddingRound.create({
          program_id: nextProgramId,
          term_id: resolvedTermId,
          round_number,
          opens_at: new Date(opens_at),
          closes_at: new Date(closes_at),
          status: 'upcoming',
          covers_all_terms: coversAllTerms,
          notes,
        }, { transaction });
        rounds.push(round);
      }
      return rounds;
    });

    const full = await BiddingRound.findAll({
      where: { id: { [Op.in]: createdRounds.map(round => round.id) } },
      include: [
        { model: Program, as: 'program', attributes: ['id', 'name', 'code'] },
        { model: Term, as: 'term', attributes: ['id', 'year', 'term_number', 'label'] },
      ],
      order: [[{ model: Program, as: 'program' }, 'name', 'ASC']],
    });

    res.status(201).json(Array.isArray(program_ids) ? full : full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── PUT /rounds/:id ──────────────────────────────────────────────────────────
const updateRound = async (req, res) => {
  try {
    const round = await BiddingRound.findByPk(req.params.id);
    if (!round) return res.status(404).json({ error: 'Round not found.' });

    const { opens_at, closes_at, notes, covers_all_terms } = req.body;
    const updates = {};
    if (opens_at !== undefined) updates.opens_at = opens_at;
    if (closes_at !== undefined) updates.closes_at = closes_at;
    if (notes !== undefined) updates.notes = notes;
    if (covers_all_terms !== undefined) updates.covers_all_terms = covers_all_terms;

    await round.update(updates);
    res.json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── POST /rounds/:id/close ───────────────────────────────────────────────────
const forceCloseRound = async (req, res) => {
  try {
    const round = await BiddingRound.findByPk(req.params.id);
    if (!round) return res.status(404).json({ error: 'Round not found.' });

    if (round.status !== 'open') {
      return res.status(400).json({ error: 'Only open rounds can be force-closed.' });
    }

    await round.update({ status: 'closed', closes_at: new Date() });
    res.json({ message: 'Round force-closed.', round });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── POST /rounds/:id/process ─────────────────────────────────────────────────
const triggerProcessing = async (req, res) => {
  try {
    const round = await BiddingRound.findByPk(req.params.id);
    if (!round) return res.status(404).json({ error: 'Round not found.' });

    if (!['closed', 'open'].includes(round.status)) {
      return res.status(400).json({ error: 'Round must be closed or open to process.' });
    }

    if (round.status === 'open') {
      await round.update({ status: 'closed', closes_at: new Date() });
    }

    const result = await processRound(round.id);
    res.json({ message: 'Round processed successfully.', ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Processing error.' });
  }
};

// ─── DELETE /rounds/:id ────────────────────────────────────────────
const deleteRound = async (req, res) => {
  try {
    const round = await BiddingRound.findByPk(req.params.id);
    if (!round) return res.status(404).json({ error: 'Round not found.' });

    if (round.status === 'open' || round.status === 'processing') {
      return res.status(400).json({
        error: `Cannot delete a round that is currently ${round.status}. Close it first.`,
      });
    }

    await round.destroy();
    res.json({ message: 'Round deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getRounds, createRound, updateRound, forceCloseRound, triggerProcessing, deleteRound };
