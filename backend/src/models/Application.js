const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Application = sequelize.define('Application', {
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
  round_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  preference_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 3 },
  },
  status: {
    type: DataTypes.ENUM('pending', 'allocated', 'displaced', 'cancelled_course'),
    defaultValue: 'pending',
  },
  sop_text: {
    type: DataTypes.TEXT,
    allowNull: true, // submitted by student when course uses SOP criteria
  },
  grade_score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true, // entered by admin when course uses grade criteria
  },
  applied_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'applications',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['student_id', 'course_id', 'round_id'],
    },
  ],
});

module.exports = Application;
