const jwt = require('jsonwebtoken');
const { User, Program } = require('../models');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Program, as: 'program', attributes: ['id', 'name', 'code', 'is_active'] }],
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid token or user deactivated.' });
    }

    if (user.program && !user.program.is_active) {
      user.setDataValue('program', null);
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient role.' });
    }
    next();
  };
};

module.exports = { auth, requireRole };
