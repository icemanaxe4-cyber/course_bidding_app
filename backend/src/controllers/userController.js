const bcrypt = require('bcryptjs');
const { User, Program, Course, CourseProgram, Allocation, Application } = require('../models');
const { Op } = require('sequelize');

const getUsers = async (req, res) => {
  try {
    const { role, programId } = req.query;
    const where = {};
    if (role) where.role = role;
    if (programId && role !== 'faculty') where.program_id = programId;

    if (programId && role === 'faculty') {
      const links = await CourseProgram.findAll({
        where: { program_id: programId },
        attributes: ['course_id'],
      });
      const linkedCourseIds = links.map(link => link.course_id);
      const floatedCourses = await Course.findAll({
        where: {
          is_floated: true,
          status: 'active',
          faculty_id: { [Op.ne]: null },
          [Op.or]: [
            { program_id: programId },
            ...(linkedCourseIds.length ? [{ id: { [Op.in]: linkedCourseIds } }] : []),
          ],
        },
        attributes: ['faculty_id'],
        group: ['faculty_id'],
      });
      where.id = { [Op.in]: floatedCourses.map(course => course.faculty_id) };
    }
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Program, as: 'program', attributes: ['id', 'name', 'code'] }],
      order: [['name', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const createUser = async (req, res) => {
  try {
    const {
      name, email, password, role,
      cqpi, student_id, department, enrollment_year, program_id,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, role are required.' });
    }

    if (role === 'student' && !program_id) {
      return res.status(400).json({ error: 'Program is required for students.' });
    }

    if (program_id) {
      const program = await Program.findOne({ where: { id: program_id, is_active: true } });
      if (!program) return res.status(400).json({ error: 'Selected program is invalid or inactive.' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(400).json({ error: 'Email already in use.' });

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password_hash,
      role,
      cqpi: role === 'student' && cqpi !== '' && cqpi !== undefined ? Number(cqpi) : null,
      student_id: role === 'student' ? student_id?.trim() || null : null,
      department: department?.trim() || null,
      enrollment_year: role === 'student' && enrollment_year ? Number(enrollment_year) : null,
      program_id: role === 'student' ? program_id : null,
    });

    const { password_hash: _, ...userData } = user.toJSON();
    res.status(201).json(userData);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Student ID or email is already in use.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const { name, cqpi, department, enrollment_year, is_active, password, program_id } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (cqpi !== undefined) updates.cqpi = cqpi;
    if (department !== undefined) updates.department = department;
    if (enrollment_year !== undefined) updates.enrollment_year = enrollment_year;
    if (is_active !== undefined) updates.is_active = is_active;
    if (program_id !== undefined) {
      if (user.role === 'student' && !program_id) {
        return res.status(400).json({ error: 'Program is required for students.' });
      }
      if (program_id) {
        const program = await Program.findOne({ where: { id: program_id, is_active: true } });
        if (!program) return res.status(400).json({ error: 'Selected program is invalid or inactive.' });
      }
      updates.program_id = user.role === 'student' ? program_id : null;
    }

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    await user.update(updates);
    if (user.role === 'faculty' && updates.is_active === false) {
      // BUG-4: Only cancel courses that have NO existing allocations
      // Courses with students already allocated must stay active
      const facultyCourses = await Course.findAll({
        where: { faculty_id: user.id, status: { [Op.ne]: 'cancelled' } },
        attributes: ['id'],
      });
      for (const c of facultyCourses) {
        const allocationCount = await Allocation.count({ where: { course_id: c.id } });
        if (allocationCount === 0) {
          await Course.update({ status: 'cancelled', is_floated: false }, { where: { id: c.id } });
          await Application.update(
            { status: 'cancelled_course' },
            { where: { course_id: c.id, status: { [Op.in]: ['pending', 'displaced'] } } }
          );
        }
      }
    } else if (user.role === 'faculty' && updates.is_active === true) {
      // BUG-5: Only restore courses that were cancelled because of faculty deactivation
      // (i.e., courses with 0 allocations AND no 'cancelled_course' applications —
      //  courses cancelled for under-subscription will have cancelled_course apps)
      const facultyCancelledCourses = await Course.findAll({
        where: { faculty_id: user.id, status: 'cancelled' },
        attributes: ['id'],
      });
      for (const c of facultyCancelledCourses) {
        const allocationCount = await Allocation.count({ where: { course_id: c.id } });
        const cancelledAppCount = await Application.count({
          where: { course_id: c.id, status: 'cancelled_course' },
        });
        if (allocationCount === 0 && cancelledAppCount === 0) {
          await Course.update({ status: 'active' }, { where: { id: c.id } });
        }
      }
    }
    const { password_hash, ...userData } = user.toJSON();
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await user.update({ is_active: false });
    if (user.role === 'faculty') {
      // BUG-4: Only cancel courses with no existing allocations (same logic as deactivation)
      const facultyCourses = await Course.findAll({
        where: { faculty_id: user.id, status: { [Op.ne]: 'cancelled' } },
        attributes: ['id'],
      });
      for (const c of facultyCourses) {
        const allocationCount = await Allocation.count({ where: { course_id: c.id } });
        if (allocationCount === 0) {
          await Course.update({ status: 'cancelled', is_floated: false }, { where: { id: c.id } });
          await Application.update(
            { status: 'cancelled_course' },
            { where: { course_id: c.id, status: { [Op.in]: ['pending', 'displaced'] } } }
          );
        }
      }
    }
    res.json({ message: 'User deactivated.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
