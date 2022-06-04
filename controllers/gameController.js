const jwt = require('jsonwebtoken');
const { EMPTY_STRING, JWT_SECRET_KEY } = require("../utils/constants");
const db = require("../utils/db");

/**
 * Save game data
 * @param {*} req request from frontend 
 * @param {*} res response to frontend
 */
exports.saveGameData = async (req, res) => {
  const { currentLives, currentLevel, idGameData } = req.body;
  let query = '';

  const { completedMaxLevel } = (await db.query(`SELECT completed_max_level AS completedMaxLevel FROM game_data WHERE id = ${idGameData};`))[0];

  if (completedMaxLevel < currentLevel - 1) {
    //  If a user update his/her completed max level
    query = `
      UPDATE game_data 
      SET current_lives = ${currentLives}, current_level = ${currentLevel}, completed_max_level = ${currentLevel - 1}
      WHERE id = ${idGameData};
    `;
  } else {
    //  Else
    query = `
      UPDATE game_data 
      SET current_lives = ${currentLives}, current_level = ${currentLevel}
      WHERE id = ${idGameData};
    `;
  }

  console.log('# query => ', query);

  db.query(query, (error) => {
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
  console.log('# accessToken => ', accessToken);
  jwt.verify(accessToken, JWT_SECRET_KEY, (error, decoded) => {
    if (error) {
      console.log('# getUserdataFromAccessToken error => ', error);
      return res.status(401).send(EMPTY_STRING);
    } else {
      return res.status(200).send(decoded);
    }
  });
};
