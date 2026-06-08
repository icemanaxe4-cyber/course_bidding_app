const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

router.get('/', auth, requireRole('admin'), getUsers);
router.post('/', auth, requireRole('admin'), createUser);
router.put('/:id', auth, requireRole('admin'), updateUser);
router.delete('/:id', auth, requireRole('admin'), deleteUser);

module.exports = router;
