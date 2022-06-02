const jwt = require('jsonwebtoken');
const { EMPTY_STRING, JWT_SECRET_KEY } = require("../utils/constants");
const db = require("../utils/db");

/**
 * Save game data
 * @param {*} req request from frontend 
 * @param {*} res response to frontend
 */
exports.saveGameData = (req, res) => {
  const { idGameData } = req.params;
  const { currentLives, currentLevel } = req.body;

  db.query(`
    UPDATE game_data 
    SET current_lives = ${currentLives}, current_level = ${currentLevel}
    WHERE id = ${idGameData}
  `, (error) => {
    if (error) {
      return res.status(501).send(EMPTY_STRING);
    } else {
      return res.status(200).send(EMPTY_STRING);
    }
  });
};

/**
 * Get userdata from access token.
 * @param {object} req Request from game
 * @param {object} res Response to game
 */
exports.getUserdataFromAccessToken = async (req, res) => {
  const { accessToken } = req.params;
  jwt.verify(accessToken, JWT_SECRET_KEY, (error, decoded) => {
    if (error) {
      return res.status(401).send('');
    } else {
      console.log('# decoded => ', decoded);
      return res.status(200).send(decoded);
    }
  });
};
