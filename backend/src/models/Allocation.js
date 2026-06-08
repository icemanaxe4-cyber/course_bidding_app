const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Allocation = sequelize.define('Allocation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  student_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  course_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  term_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  round_id: {
    type: DataTypes.UUID,
    allowNull: true, // null = manually assigned by admin
  },
  allocated_by: {
    type: DataTypes.ENUM('system', 'admin'),
    defaultValue: 'system',
  },
  allocated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'allocations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['student_id', 'course_id', 'term_id'],
    },
  ],
});

module.exports = Allocation;
