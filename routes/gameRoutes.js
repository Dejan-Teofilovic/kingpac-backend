const express = require('express');
const router = express.Router();
const { saveGameData, getUserdataFromAccessToken } = require('../controllers/gameController');

router.put('/saveGameData/:idGameData', saveGameData);
router.get('/getUserdataFromAccessToken/:accessToken', getUserdataFromAccessToken);

module.exports = router;