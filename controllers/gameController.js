const { EMPTY_STRING } = require("../utils/constants");
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