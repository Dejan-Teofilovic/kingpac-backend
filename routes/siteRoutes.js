const express = require('express');
const router = express.Router();
const { getUserdata, registerUser } = require('../controllers/siteController');

router.get('/getUserdata/:walletAddress', getUserdata);
router.post('/registerUser', registerUser);

module.exports = router;