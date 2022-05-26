const express = require('express');
const router = express.Router();
const { saveGameData } = require('../controllers/gameController');

router.post('/saveGameData', registerUser);

module.exports = router;