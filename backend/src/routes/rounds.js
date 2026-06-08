const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getRounds, createRound, updateRound, forceCloseRound, triggerProcessing, deleteRound } = require('../controllers/roundController');

router.get('/', auth, getRounds);
router.post('/', auth, requireRole('admin'), createRound);
router.put('/:id', auth, requireRole('admin'), updateRound);
router.post('/:id/close', auth, requireRole('admin'), forceCloseRound);
router.post('/:id/process', auth, requireRole('admin'), triggerProcessing);
router.delete('/:id', auth, requireRole('admin'), deleteRound);

module.exports = router;
