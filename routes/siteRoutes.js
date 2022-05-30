const express = require('express');
const router = express.Router();
const { getUserdata, registerUser, saveWinners, getWinners } = require('../controllers/siteController');

router.get('/getUserdata/:walletAddress', getUserdata);
router.post('/registerUser', registerUser);
router.put('/saveWinners/:period', saveWinners);
router.get('/getWinners', getWinners);

module.exports = router;