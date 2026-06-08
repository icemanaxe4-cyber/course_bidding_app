const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getMyApplications, submitApplications, deleteApplication } = require('../controllers/applicationController');

router.get('/my', auth, requireRole('student'), getMyApplications);
router.post('/', auth, requireRole('student'), submitApplications);
router.delete('/:id', auth, requireRole('student'), deleteApplication);

module.exports = router;
