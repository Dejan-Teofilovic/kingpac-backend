const express = require('express');
const router = express.Router();
const { saveGameData } = require('../controllers/gameController');

router.put('/saveGameData/:idGameData', saveGameData);

module.exports = router;