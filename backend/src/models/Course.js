const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  credits: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: false,
    defaultValue: 3.0,
  },
  faculty_id: {
    type: DataTypes.UUID,
    allowNull: true, // null for visiting faculty courses
  },
  term_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  program_id: {
    type: DataTypes.UUID,
    allowNull: true, // optional program association
  },
  min_strength: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
  },
  max_strength: {
    type: DataTypes.INTEGER,
    defaultValue: 120,
  },
  cqpi_cutoff: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 0.0,
    validate: { min: 0, max: 10 },
  },
  allocation_criteria: {
    type: DataTypes.ENUM('cqpi', 'sop', 'grade'),
    defaultValue: 'cqpi',
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'cancelled'),
    defaultValue: 'draft',
  },
  is_floated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_frozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_visiting: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  current_enrollment: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'courses',
  timestamps: true,
  underscored: true,
});

module.exports = Course;
