const express = require('express');
const router = express.Router();
const { saveGameData, getUserdataFromAccessToken } = require('../controllers/gameController');

router.post('/saveGameData', saveGameData);
router.get('/getUserdataFromAccessToken/:accessToken', getUserdataFromAccessToken);

module.exports = router;