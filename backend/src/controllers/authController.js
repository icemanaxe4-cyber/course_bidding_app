const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Program } = require('../models');

const buildAuthPayload = (user) => {
  const visibleProgram = user.program?.is_active ? user.program : null;
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cqpi: user.cqpi,
      student_id: user.student_id,
      department: user.department,
      enrollment_year: user.enrollment_year,
      program_id: user.program_id,
      program: visibleProgram ? {
        id: visibleProgram.id,
        name: visibleProgram.name,
        code: visibleProgram.code,
        is_active: visibleProgram.is_active,
      } : null,
    },
  };
};

// ─── Login (email + password) ─────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      include: [{ model: Program, as: 'program', attributes: ['id', 'name', 'code', 'is_active'] }],
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated. Please contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    res.json(buildAuthPayload(user));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── Get current user ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// ─── Change Password ──────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findByPk(req.user.id);

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await user.update({ password_hash: hash });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// NOTE: Public signup has been removed.
// All accounts (student, faculty, admin) must be created by an admin via /api/users.

module.exports = { login, getMe, changePassword };
