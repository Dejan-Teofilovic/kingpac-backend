const express = require('express');
const router = express.Router();
const { getUserdata, registerUser, saveWinners, getWinners, updateBalance, getAccessToken } = require('../controllers/siteController');

router.get('/getUserdata/:walletAddress', getUserdata);
router.post('/registerUser', registerUser);
router.get('/saveWinners', saveWinners);
router.get('/getWinners', getWinners);
router.put('/updateBalance/:idWalletAddress', updateBalance);
router.post('/getAccessToken', getAccessToken);

module.exports = router;