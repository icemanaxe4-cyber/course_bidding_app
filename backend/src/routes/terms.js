const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getTerms, getTerm, createTerm, updateTerm } = require('../controllers/termController');

router.get('/', auth, getTerms);
router.get('/:id', auth, getTerm);
router.post('/', auth, requireRole('admin'), createTerm);
router.put('/:id', auth, requireRole('admin'), updateTerm);

module.exports = router;
