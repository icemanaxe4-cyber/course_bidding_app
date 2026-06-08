const { Application, Course, BiddingRound, Allocation, User, CourseProgram } = require('../models');
const { Op } = require('sequelize');

const MIN_COURSES_PER_TERM = 1;
const MAX_COURSES_PER_TERM = 3;

const getUnallocationReason = (application, studentCQPI) => {
  const course = application.course;
  if (application.status === 'allocated') return null;
  if (application.status === 'pending') return 'Round is not processed yet.';

  if (!course) return 'Course is no longer available.';

  if (application.status === 'cancelled_course') {
    if (course.status === 'cancelled') {
      return `Course was cancelled because it did not meet the minimum enrollment of ${course.min_strength}.`;
    }
    if (!course.is_floated) return 'Course was un-floated before allocation.';
    return 'Course was cancelled before allocation.';
  }

  if (parseFloat(studentCQPI) < parseFloat(course.cqpi_cutoff)) {
    return `Your CQPI was below the course cutoff of ${course.cqpi_cutoff}.`;
  }

  const criteria = course.allocation_criteria || 'cqpi';
  if (criteria === 'sop') {
    return 'Seats were filled by applicants with higher SOP scores or earlier submission time.';
  }
  if (criteria === 'grade') {
    return 'Seats were filled by applicants with higher grade scores or earlier submission time.';
  }
  return 'Seats were filled by applicants with higher CQPI or earlier submission time.';
};

const getMyApplications = async (req, res) => {
  try {
    const { roundId, termId, includeResults } = req.query;
    const shouldIncludeResults = includeResults === 'true';
    const where = { student_id: req.user.id };

    if (!shouldIncludeResults) where.status = 'pending';

    if (roundId) {
      where.round_id = roundId;
    } else if (termId && !shouldIncludeResults) {
      const rounds = await BiddingRound.findAll({ where: { term_id: termId }, attributes: ['id'] });
      where.round_id = { [Op.in]: rounds.map(r => r.id) };
    }

    const courseWhere = shouldIncludeResults
      ? (termId ? { term_id: termId } : undefined)
      : {
        status: 'active',
        is_floated: true,
      };

    const applications = await Application.findAll({
      where,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: [
            'id', 'code', 'name', 'credits', 'cqpi_cutoff', 'status',
            'allocation_criteria', 'is_frozen', 'is_floated',
            'min_strength', 'max_strength', 'term_id',
          ],
          where: courseWhere,
          include: [{ model: User, as: 'faculty', attributes: ['id', 'name'] }],
        },
        {
          model: BiddingRound,
          as: 'round',
          attributes: ['id', 'round_number', 'status', 'processed_at'],
        },
      ],
      order: [['preference_order', 'ASC']],
    });

    const result = shouldIncludeResults
      ? applications.map(application => ({
        ...application.toJSON(),
        unallocation_reason: getUnallocationReason(application, req.user.cqpi),
      }))
      : applications;

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const submitApplications = async (req, res) => {
  try {
    const { round_id, selections } = req.body;
    // selections: [{ course_id, preference_order, sop_text? }]

    if (!round_id || !selections || !Array.isArray(selections)) {
      return res.status(400).json({ error: 'round_id and selections array are required.' });
    }

    if (selections.length < MIN_COURSES_PER_TERM || selections.length > MAX_COURSES_PER_TERM) {
      return res.status(400).json({
        error: `You must select between ${MIN_COURSES_PER_TERM} and ${MAX_COURSES_PER_TERM} courses.`,
      });
    }

    const round = await BiddingRound.findByPk(round_id);
    if (!round) return res.status(404).json({ error: 'Round not found.' });
    if (round.status !== 'open') {
      return res.status(400).json({ error: 'This round is not currently open for applications.' });
    }
    if (round.program_id && req.user.program_id !== round.program_id) {
      return res.status(403).json({ error: 'This bidding round is not available for your program.' });
    }

    const courseIds = selections.map(s => s.course_id);
    if (new Set(courseIds).size !== courseIds.length) {
      return res.status(400).json({ error: 'Duplicate courses are not allowed.' });
    }

    const preferenceOrders = selections.map(s => Number(s.preference_order));
    if (
      preferenceOrders.some(n => !Number.isInteger(n) || n < 1 || n > MAX_COURSES_PER_TERM) ||
      new Set(preferenceOrders).size !== preferenceOrders.length
    ) {
      return res.status(400).json({
        error: `Preference orders must be unique numbers from 1 to ${MAX_COURSES_PER_TERM}.`,
      });
    }

    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds }, status: 'active', is_floated: true },
    });

    if (courses.length !== courseIds.length) {
      return res.status(400).json({ error: 'One or more courses are invalid, inactive, or not floated.' });
    }

    const wrongTerm = courses.find(c => c.term_id !== round.term_id);
    if (wrongTerm && !round.covers_all_terms) {
      return res.status(400).json({
        error: 'All selected courses must belong to the current bidding round term.',
      });
    }

    if (round.program_id) {
      const courseProgramLinks = await CourseProgram.findAll({
        where: {
          course_id: { [Op.in]: courseIds },
          program_id: round.program_id,
        },
        attributes: ['course_id'],
      });
      const linkedCourseIds = new Set(courseProgramLinks.map(link => link.course_id));
      const wrongProgram = courses.find(c => c.program_id !== round.program_id && !linkedCourseIds.has(c.id));
      if (wrongProgram) {
        return res.status(400).json({
          error: 'One or more selected courses are not allotted to your program.',
        });
      }
    }

    const studentCQPI = parseFloat(req.user.cqpi) || 0;
    const ineligible = courses.filter(c => studentCQPI < parseFloat(c.cqpi_cutoff));
    if (ineligible.length > 0) {
      return res.status(400).json({
        error: `You do not meet the CQPI cutoff for: ${ineligible.map(c => c.name).join(', ')}`,
      });
    }

    // Validate SOP text for courses requiring SOP criteria
    for (const sel of selections) {
      const course = courses.find(c => c.id === sel.course_id);
      if (course && course.allocation_criteria === 'sop' && !sel.sop_text?.trim()) {
        return res.status(400).json({
          error: `A Statement of Purpose (SOP) is required for "${course.name}".`,
        });
      }
    }

    // Delete existing applications for this student in this round
    await Application.destroy({ where: { student_id: req.user.id, round_id } });

    // Create new applications
    const apps = selections.map(s => {
      const course = courses.find(c => c.id === s.course_id);
      return {
        student_id: req.user.id,
        course_id: s.course_id,
        round_id,
        preference_order: s.preference_order,
        status: 'pending',
        sop_text: course?.allocation_criteria === 'sop' ? (s.sop_text || null) : null,
        grade_score: null, // admin enters grade scores separately
        applied_at: new Date(),
      };
    });

    const created = await Application.bulkCreate(apps);
    res.status(201).json({ message: 'Applications submitted successfully.', count: created.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteApplication = async (req, res) => {
  try {
    const app = await Application.findOne({
      where: { id: req.params.id, student_id: req.user.id },
      include: [{ model: BiddingRound, as: 'round' }],
    });

    if (!app) return res.status(404).json({ error: 'Application not found.' });
    if (app.round.status !== 'open') {
      return res.status(400).json({ error: 'Cannot modify applications when round is closed.' });
    }

    await app.destroy();
    res.json({ message: 'Application removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getMyApplications, submitApplications, deleteApplication };
