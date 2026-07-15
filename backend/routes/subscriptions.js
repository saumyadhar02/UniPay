const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const subsCtrl = require('../controllers/subscriptionsController');

router.post('/', auth, subsCtrl.create);
router.get('/', auth, subsCtrl.list);
router.delete('/:id', auth, subsCtrl.cancel);

module.exports = router;
