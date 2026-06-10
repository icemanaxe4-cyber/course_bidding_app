const { Allocation, User, Course, BiddingRound, Term, Application } = require('../models');
const { Op } = require('sequelize');
const { getDisplacedStudentsForTerm, getTermStats } = require('../services/allocationService');

const getMyAllocations = async (req, res) => {
  try {
    const { termId } = req.query;
    const where = { student_id: req.user.id };
    if (termId) where.term_id = termId;

    const allocations = await Allocation.findAll({
      where,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'code', 'name', 'credits', 'description'],
          include: [{ model: User, as: 'faculty', attributes: ['id', 'name'] }],
        },
        { model: Term, as: 'term', attributes: ['id', 'year', 'term_number', 'label'] },
        { model: BiddingRound, as: 'round', attributes: ['id', 'round_number'] },
      ],
      order: [['allocated_at', 'ASC']],
    });

    res.json(allocations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getAllAllocations = async (req, res) => {
  try {
    const { termId, roundId, courseId } = req.query;
    const where = {};
    if (termId) where.term_id = termId;
    if (roundId) where.round_id = roundId;
    if (courseId) where.course_id = courseId;

    const allocations = await Allocation.findAll({
      where,
      include: [
        { model: User, as: 'student', attributes: ['id', 'name', 'email', 'student_id', 'cqpi'] },
        { model: Course, as: 'course', attributes: ['id', 'code', 'name'] },
        { model: BiddingRound, as: 'round', attributes: ['id', 'round_number'] },
      ],
      order: [['allocated_at', 'ASC']],
    });

    res.json(allocations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const manualAllocate = async (req, res) => {
  try {
    const { student_id, course_id, term_id, round_id } = req.body;

    if (!student_id || !course_id || !term_id) {
      return res.status(400).json({ error: 'student_id, course_id, term_id are required.' });
    }

    const student = await User.findByPk(student_id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const course = await Course.findByPk(course_id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    if (course.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot allocate to a cancelled course.' });
    }
    const currentEnrollment = await Allocation.count({ where: { course_id } });
    if (currentEnrollment >= course.max_strength) {
      return res.status(400).json({ error: 'Course is at max capacity.' });
    }

    const existing = await Allocation.findOne({ where: { student_id, course_id, term_id } });
    if (existing) {
      return res.status(400).json({ error: 'Student is already allocated to this course this term.' });
    }

    let resolvedRoundId = round_id || null;
    if (resolvedRoundId) {
      const round = await BiddingRound.findByPk(resolvedRoundId);
      if (!round) return res.status(404).json({ error: 'Round not found.' });
    } else {
      const application = await Application.findOne({
        where: { student_id, course_id },
        include: [
          {
            model: BiddingRound,
            as: 'round',
            where: { term_id },
            attributes: ['id'],
          },
        ],
        order: [['applied_at', 'DESC']],
      });
      resolvedRoundId = application?.round_id || null;
    }

    const allocation = await Allocation.create({
      student_id,
      course_id,
      term_id,
      round_id: resolvedRoundId,
      allocated_by: 'admin',
    });

    // GAP-3: Mark the student's pending/displaced application for this course as allocated
    await Application.update(
      { status: 'allocated' },
      { where: { student_id, course_id, status: { [Op.in]: ['pending', 'displaced'] } } }
    );

    // BUG-2: Do NOT increment stored current_enrollment — withCourseCounts computes it live
    res.status(201).json({ message: 'Manual allocation successful.', allocation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getDisplacedStudents = async (req, res) => {
  try {
    const { termId } = req.query;
    if (!termId) return res.status(400).json({ error: 'termId is required.' });

    const students = await getDisplacedStudentsForTerm(termId);
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getStats = async (req, res) => {
  try {
    const { termId } = req.query;
    if (!termId) return res.status(400).json({ error: 'termId is required.' });

    const stats = await getTermStats(termId);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getMyAllocations, getAllAllocations, manualAllocate, getDisplacedStudents, getStats };
