const { Course, User, Term, Application, BiddingRound, Program, CourseProgram, Allocation } = require('../models');
const { Op } = require('sequelize');

// ─── Common include helpers ──────────────────────────────────────────────────
const courseIncludes = [
  { model: User, as: 'faculty', attributes: ['id', 'name', 'email', 'department'] },
  { model: Term, as: 'term', attributes: ['id', 'year', 'term_number', 'label'] },
  { model: Program, as: 'program', attributes: ['id', 'name', 'code', 'is_active'], where: { is_active: true }, required: false },
  { model: Program, as: 'programs', attributes: ['id', 'name', 'code', 'is_active'], where: { is_active: true }, required: false, through: { attributes: [] } },
];

const normalizeProgramIds = (program_ids, program_id) => {
  const raw = Array.isArray(program_ids) ? program_ids : [];
  if (program_id) raw.push(program_id);
  return [...new Set(raw.filter(Boolean))];
};

const syncCoursePrograms = async (course, programIds, options = {}) => {
  await course.setPrograms(programIds, options);
  await course.update({ program_id: programIds[0] || null }, options);
};

const courseProgramWhere = async (programId, transaction) => {
  const links = await CourseProgram.findAll({
    where: { program_id: programId },
    attributes: ['course_id'],
    transaction,
  });
  const linkedCourseIds = links.map(link => link.course_id);
  return {
    [Op.or]: [
      { program_id: programId },
      ...(linkedCourseIds.length ? [{ id: { [Op.in]: linkedCourseIds } }] : []),
    ],
  };
};

const deactivateFacultyIfNoActiveCourses = async (facultyId) => {
  if (!facultyId) return;
  const activeCourseCount = await Course.count({
    where: {
      faculty_id: facultyId,
      status: { [Op.ne]: 'cancelled' },
    },
  });
  if (activeCourseCount === 0) {
    await User.update({ is_active: false }, { where: { id: facultyId, role: 'faculty' } });
  }
};

const withCourseCounts = async (course) => {
  const courseJson = course.toJSON();
  const [applicantCount, currentEnrollment] = await Promise.all([
    Application.count({ where: { course_id: course.id } }),
    Allocation.count({ where: { course_id: course.id } }),
  ]);

  return {
    ...courseJson,
    applicant_count: applicantCount,
    current_enrollment: currentEnrollment,
  };
};

// ─── GET /courses ────────────────────────────────────────────────────────────
// Admin: all courses
// Faculty: all courses (read-only, with optional filters)
// Student: only floated + active courses
const getCourses = async (req, res) => {
  try {
    const { termId, programId, filter, facultyId } = req.query;
    const where = {};

    if (req.user.role === 'student' && (!req.user.program_id || !req.user.program)) {
      return res.json([]);
    }

    const effectiveProgramId = programId || (req.user.role === 'student' ? req.user.program_id : null);
    if (termId) where.term_id = termId;
    if (effectiveProgramId) Object.assign(where, await courseProgramWhere(effectiveProgramId));

    if (req.user.role === 'student') {
      // Students only see floated + active courses
      where.is_floated = true;
      where.status = 'active';
    }

    // Faculty filters: 'mine' | 'term1' | 'term2' | 'term3' | 'others' | undefined (all)
    if (req.user.role === 'faculty' && filter) {
      if (filter === 'mine') {
        where.faculty_id = req.user.id;
      } else if (filter === 'others') {
        where.faculty_id = { [Op.ne]: req.user.id };
      }
      // term1/term2/term3 filtering done via termId param from frontend
    }

    // Admin: optional faculty filter
    if (req.user.role === 'admin' && facultyId) {
      where.faculty_id = facultyId;
    }

    const courses = await Course.findAll({
      where,
      include: courseIncludes,
      order: [['created_at', 'DESC']],
    });

    let result = courses;
    if (req.user.role === 'student') {
      result = await Promise.all(courses.map(async (course) => {
        const courseJson = await withCourseCounts(course);
        return {
          ...courseJson,
          is_eligible: parseFloat(req.user.cqpi) >= parseFloat(course.cqpi_cutoff),
        };
      }));
    } else {
      result = await Promise.all(courses.map(withCourseCounts));
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET /courses/:id ────────────────────────────────────────────────────────
const getCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, { include: courseIncludes });
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    // Students can only see floated courses
    if (req.user.role === 'student' && !course.is_floated) {
      return res.status(403).json({ error: 'Course not available.' });
    }

    if (req.user.role === 'student' && req.user.program_id) {
      const programLinks = await course.getPrograms({ attributes: ['id'] });
      const allowedProgramIds = programLinks.length
        ? programLinks.map(p => p.id)
        : (course.program_id ? [course.program_id] : []);
      if (!allowedProgramIds.includes(req.user.program_id)) {
        return res.status(403).json({ error: 'Course not available for your program.' });
      }
    }

    res.json(await withCourseCounts(course));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── POST /courses  (Admin only) ─────────────────────────────────────────────
const createCourse = async (req, res) => {
  try {
    const {
      code, name, description, credits, term_id, faculty_id,
      cqpi_cutoff, min_strength, max_strength,
      allocation_criteria, is_visiting, program_id, program_ids,
    } = req.body;

    if (!code || !name || !term_id) {
      return res.status(400).json({ error: 'code, name, and term_id are required.' });
    }

    const term = await Term.findByPk(term_id);
    if (!term) return res.status(404).json({ error: 'Term not found.' });

    const selectedProgramIds = normalizeProgramIds(program_ids, program_id);
    if (selectedProgramIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one program for this course.' });
    }

    const programCount = await Program.count({
      where: { id: { [Op.in]: selectedProgramIds }, is_active: true },
    });
    if (programCount !== selectedProgramIds.length) {
      return res.status(400).json({ error: 'One or more selected programs are invalid or inactive.' });
    }

    // Validate faculty if provided
    if (faculty_id) {
      const faculty = await User.findOne({ where: { id: faculty_id, role: 'faculty', is_active: true } });
      if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });
    }

    const minStrength = Number(min_strength ?? 15);
    const maxStrength = Number(max_strength ?? 120);

    if (minStrength < 1 || maxStrength < minStrength) {
      return res.status(400).json({ error: 'Seat limits must be valid.' });
    }

    const validCriteria = ['cqpi', 'sop', 'grade'];
    const criteria = validCriteria.includes(allocation_criteria) ? allocation_criteria : 'cqpi';

    const course = await Course.create({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description,
      credits: Number(credits) || 3,
      faculty_id: faculty_id || null,
      term_id,
      program_id: selectedProgramIds[0] || null,
      cqpi_cutoff: Number(cqpi_cutoff) || 0,
      min_strength: minStrength,
      max_strength: maxStrength,
      allocation_criteria: criteria,
      is_visiting: is_visiting === true || is_visiting === 'true',
      status: 'active',
      is_floated: true,
      is_frozen: false,
    });

    await syncCoursePrograms(course, selectedProgramIds);

    const full = await Course.findByPk(course.id, { include: courseIncludes });
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── PUT /courses/:id  (Admin only) ──────────────────────────────────────────
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const {
      name, description, credits, cqpi_cutoff, status,
      min_strength, max_strength, faculty_id, program_id, program_ids,
      allocation_criteria, is_visiting, term_id,
    } = req.body;

    const updates = {};
    const selectedProgramIds = program_ids !== undefined || program_id !== undefined
      ? normalizeProgramIds(program_ids, program_id)
      : null;

    if (selectedProgramIds && selectedProgramIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one program for this course.' });
    }

    if (selectedProgramIds) {
      const programCount = await Program.count({
        where: { id: { [Op.in]: selectedProgramIds }, is_active: true },
      });
      if (programCount !== selectedProgramIds.length) {
        return res.status(400).json({ error: 'One or more selected programs are invalid or inactive.' });
      }
    }

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (credits !== undefined) updates.credits = Number(credits);
    if (cqpi_cutoff !== undefined) updates.cqpi_cutoff = Number(cqpi_cutoff);
    if (status !== undefined) updates.status = status;
    if (term_id !== undefined) updates.term_id = term_id || null;
    if (min_strength !== undefined) updates.min_strength = Number(min_strength);
    if (max_strength !== undefined) updates.max_strength = Number(max_strength);
    if (faculty_id !== undefined) updates.faculty_id = faculty_id || null;
    if (allocation_criteria !== undefined) updates.allocation_criteria = allocation_criteria;
    if (is_visiting !== undefined) updates.is_visiting = is_visiting === true || is_visiting === 'true';

    const existingProgramIds = (await course.getPrograms()).map(p => p.id);
    const nextProgramIds = selectedProgramIds
      || (existingProgramIds.length ? existingProgramIds : (course.program_id ? [course.program_id] : []));
    const nextFacultyId = faculty_id !== undefined ? faculty_id : course.faculty_id;
    if (nextFacultyId) {
      const faculty = await User.findOne({ where: { id: nextFacultyId, role: 'faculty' } });
      if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });
    }

    if (updates.min_strength !== undefined || updates.max_strength !== undefined) {
      const nextMin = updates.min_strength ?? course.min_strength;
      const nextMax = updates.max_strength ?? course.max_strength;
      if (nextMin < 1 || nextMax < nextMin) {
        return res.status(400).json({ error: 'Seat limits must be valid.' });
      }
    }

    await course.update(updates);
    if (updates.status === 'cancelled') {
      await course.update({ is_floated: false });
      await deactivateFacultyIfNoActiveCourses(course.faculty_id);
    } else if (updates.status === 'active' && course.faculty_id) {
      await course.update({ is_floated: true });
      await User.update({ is_active: true }, { where: { id: course.faculty_id, role: 'faculty' } });
    } else if (updates.status === 'active') {
      await course.update({ is_floated: true });
    }
    if (selectedProgramIds) await syncCoursePrograms(course, selectedProgramIds);
    const full = await Course.findByPk(course.id, { include: courseIncludes });
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── DELETE /courses/:id  (Admin only) ───────────────────────────────────────
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    const facultyId = course.faculty_id;
    await course.destroy();
    await deactivateFacultyIfNoActiveCourses(facultyId);
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── PATCH /courses/:id/float  (Admin only) ───────────────────────────────────
const floatCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const body = req.body || {};

    // If a faculty_id is provided (optional, for visiting courses), assign it at float time
    if (body.faculty_id) {
      const faculty = await User.findOne({ where: { id: body.faculty_id, role: 'faculty', is_active: true } });
      if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });
      await course.update({ faculty_id: body.faculty_id, is_floated: true });
    } else {
      // Always allow float — visiting courses can be floated without a faculty assigned yet
      const nextFloated = !course.is_floated;
      await course.update({ is_floated: nextFloated });
      if (!nextFloated) {
        await Application.update(
          { status: 'cancelled_course' },
          { where: { course_id: course.id, status: 'pending' } }
        );
      }
    }

    const full = await Course.findByPk(course.id, { include: courseIncludes });
    res.json({ message: `Course ${full.is_floated ? 'floated' : 'unfloated'}.`, course: full });
  } catch (err) {
    console.error('[floatCourse error]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};


// ─── PATCH /courses/:id/freeze  (Admin only) ─────────────────────────────────
const freezeCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    await course.update({ is_frozen: !course.is_frozen });
    res.json({ message: `Course ${course.is_frozen ? 'frozen' : 'unfrozen'}.`, course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET /courses/:id/applicants  (Admin/Faculty view) ────────────────────────
const getCourseApplicants = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const applications = await Application.findAll({
      where: { course_id: req.params.id },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'name', 'email', 'student_id', 'cqpi', 'program_id'],
          include: [
            { model: require('../models/Program'), as: 'program', attributes: ['id', 'name', 'code'] },
          ],
        },
        { model: BiddingRound, as: 'round', attributes: ['id', 'round_number', 'status'] },
      ],
      order: [['applied_at', 'ASC']],
    });

    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── PATCH /courses/:id/applicants/:appId/grade  (Admin only) ────────────────
// Admin sets grade_score for a specific application (when course uses grade criteria)
const setApplicantGrade = async (req, res) => {
  try {
    const { appId } = req.params;
    const { grade_score } = req.body;

    if (grade_score === undefined || grade_score === null) {
      return res.status(400).json({ error: 'grade_score is required.' });
    }

    const app = await Application.findOne({
      where: { id: appId, course_id: req.params.id },
    });

    if (!app) return res.status(404).json({ error: 'Application not found.' });

    await app.update({ grade_score: Number(grade_score) });
    res.json({ message: 'Grade score updated.', application: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  floatCourse,
  freezeCourse,
  getCourseApplicants,
  setApplicantGrade,
};
