const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const {
  getMyAllocations, getAllAllocations, manualAllocate, getDisplacedStudents, getStats
} = require('../controllers/allocationController');

router.get('/my', auth, requireRole('student'), getMyAllocations);
router.get('/', auth, requireRole('admin', 'faculty'), getAllAllocations);
router.get('/displaced', auth, requireRole('admin'), getDisplacedStudents);
router.get('/stats', auth, requireRole('admin'), getStats);
router.post('/manual', auth, requireRole('admin'), manualAllocate);

module.exports = router;
