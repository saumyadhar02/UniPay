const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);

// Private
router.get('/me', auth, authController.getMe);

module.exports = router;
