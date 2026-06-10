const { Program, User, Course, BiddingRound } = require('../models');

const getPrograms = async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { is_active: true };
    const programs = await Program.findAll({ where, order: [['name', 'ASC']] });
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getProgram = async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    if (req.user.role !== 'admin' && !program.is_active) {
      return res.status(404).json({ error: 'Program not found.' });
    }
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const createProgram = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required.' });
    }

    const existing = await Program.findOne({ where: { code: code.toUpperCase() } });
    if (existing) return res.status(400).json({ error: 'A program with this code already exists.' });

    const program = await Program.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description || null,
      is_active: true,
    });
    res.status(201).json(program);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateProgram = async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });

    const { name, description, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    await program.update(updates);
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteProgram = async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });

    // Block deletion if courses are still linked to this program
    const courseCount = await Course.count({ where: { program_id: program.id } });
    if (courseCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${courseCount} course(s) are linked to this program. Remove them first.`,
      });
    }

    // Reset program_id to null for all students enrolled in this program
    await User.update({ program_id: null }, { where: { program_id: program.id } });

    // Clean up bidding rounds for this program
    await BiddingRound.destroy({ where: { program_id: program.id } });

    // Permanently delete the program
    await program.destroy();
    res.json({ message: 'Program permanently deleted. Linked students have been unassigned.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getPrograms, getProgram, createProgram, updateProgram, deleteProgram };
