const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const {
  getCourses, getCourse, createCourse, updateCourse, deleteCourse,
  floatCourse, freezeCourse, getCourseApplicants, setApplicantGrade,
} = require('../controllers/courseController');

// Read — all authenticated roles
router.get('/', auth, getCourses);

// Applicants — admin and faculty can view
router.get('/:id/applicants', auth, requireRole('faculty', 'admin'), getCourseApplicants);

// Admin sets grade score for an applicant
router.patch('/:id/applicants/:appId/grade', auth, requireRole('admin'), setApplicantGrade);

// Write — admin only
router.get('/:id', auth, getCourse);
router.post('/', auth, requireRole('admin'), createCourse);
router.put('/:id', auth, requireRole('admin'), updateCourse);
router.delete('/:id', auth, requireRole('admin'), deleteCourse);

// Float / Freeze toggles — admin only
router.patch('/:id/float', auth, requireRole('admin'), floatCourse);
router.patch('/:id/freeze', auth, requireRole('admin'), freezeCourse);

module.exports = router;
