const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('student', 'faculty', 'admin'),
    allowNull: false,
    defaultValue: 'student',
  },
  cqpi: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true, // null for faculty/admin
    validate: { min: 0, max: 10 },
  },
  enrollment_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  student_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  program_id: {
    type: DataTypes.UUID,
    allowNull: true, // links students to an MBA program
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

module.exports = User;
