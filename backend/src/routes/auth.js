const express = require('express');
const router = express.Router();
const { login, supabaseLogin, getMe, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.post('/supabase', supabaseLogin);
// /signup route removed — all user creation is admin-only via /api/users
router.get('/me', auth, getMe);
router.put('/change-password', auth, changePassword);

module.exports = router;
