const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').matches(/^[0-9]{10}$/).withMessage('Invalid phone number'),
    body('pin').matches(/^[0-9]{4}$/).withMessage('PIN must be 4 digits')
  ],
  authController.register
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('phone').matches(/^[0-9]{10}$/).withMessage('Invalid phone number'),
    body('pin').matches(/^[0-9]{4}$/).withMessage('PIN must be 4 digits')
  ],
  authController.login
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, authController.getMe);

module.exports = router;