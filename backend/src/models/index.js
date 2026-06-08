const sequelize = require('../config/db');
const User = require('./User');
const Term = require('./Term');
const Course = require('./Course');
const BiddingRound = require('./BiddingRound');
const Application = require('./Application');
const Allocation = require('./Allocation');
const Program = require('./Program');
const CourseProgram = require('./CourseProgram');

// Program <-> User (students belong to a program)
Program.hasMany(User, { foreignKey: 'program_id', as: 'students' });
User.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });

// Program <-> Course
Program.hasMany(Course, { foreignKey: 'program_id', as: 'courses' });
Course.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.belongsToMany(Course, {
  through: CourseProgram,
  foreignKey: 'program_id',
  otherKey: 'course_id',
  as: 'allotted_courses',
});
Course.belongsToMany(Program, {
  through: CourseProgram,
  foreignKey: 'course_id',
  otherKey: 'program_id',
  as: 'programs',
});

// User <-> Course (faculty teaches courses) — nullable faculty_id for visiting
User.hasMany(Course, { foreignKey: 'faculty_id', as: 'taught_courses' });
Course.belongsTo(User, { foreignKey: 'faculty_id', as: 'faculty' });

// Term <-> Course
Term.hasMany(Course, { foreignKey: 'term_id', as: 'courses' });
Course.belongsTo(Term, { foreignKey: 'term_id', as: 'term' });

// Term <-> BiddingRound
Term.hasMany(BiddingRound, { foreignKey: 'term_id', as: 'rounds' });
BiddingRound.belongsTo(Term, { foreignKey: 'term_id', as: 'term' });

// Program <-> BiddingRound
Program.hasMany(BiddingRound, { foreignKey: 'program_id', as: 'rounds' });
BiddingRound.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });

// Student <-> Application
User.hasMany(Application, { foreignKey: 'student_id', as: 'applications' });
Application.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

// Course <-> Application
Course.hasMany(Application, { foreignKey: 'course_id', as: 'applications' });
Application.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// BiddingRound <-> Application
BiddingRound.hasMany(Application, { foreignKey: 'round_id', as: 'applications' });
Application.belongsTo(BiddingRound, { foreignKey: 'round_id', as: 'round' });

// Student <-> Allocation
User.hasMany(Allocation, { foreignKey: 'student_id', as: 'allocations' });
Allocation.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

// Course <-> Allocation
Course.hasMany(Allocation, { foreignKey: 'course_id', as: 'allocations' });
Allocation.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Term <-> Allocation
Term.hasMany(Allocation, { foreignKey: 'term_id', as: 'allocations' });
Allocation.belongsTo(Term, { foreignKey: 'term_id', as: 'term' });

// BiddingRound <-> Allocation
BiddingRound.hasMany(Allocation, { foreignKey: 'round_id', as: 'allocations' });
Allocation.belongsTo(BiddingRound, { foreignKey: 'round_id', as: 'round' });

module.exports = {
  sequelize,
  User,
  Term,
  Course,
  BiddingRound,
  Application,
  Allocation,
  Program,
  CourseProgram,
};
