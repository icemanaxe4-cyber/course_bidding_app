const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CourseProgram = sequelize.define('CourseProgram', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  course_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  program_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'course_programs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['course_id', 'program_id'],
    },
  ],
});

module.exports = CourseProgram;
