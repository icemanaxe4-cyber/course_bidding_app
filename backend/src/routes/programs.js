const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getPrograms, getProgram, createProgram, updateProgram, deleteProgram } = require('../controllers/programController');

router.get('/', auth, getPrograms);                              // all roles can view
router.get('/:id', auth, getProgram);                           // all roles
router.post('/', auth, requireRole('admin'), createProgram);    // admin only
router.put('/:id', auth, requireRole('admin'), updateProgram);  // admin only
router.delete('/:id', auth, requireRole('admin'), deleteProgram); // admin only

module.exports = router;
