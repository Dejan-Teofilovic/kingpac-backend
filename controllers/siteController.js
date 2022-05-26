const { EMPTY_STRING } = require("../utils/constants");
const db = require("../utils/db");

/**
 * Get userdata
 * @param {*} req request from frontend
 * @param {*} res response to backend
 * @returns response object
 */
exports.getUserdata = async (req, res) => {
  const { walletAddress } = req.params;

  const userdata = (await db.query(`
    SELECT 
      game_data.id_wallet_address AS idWalletAddress,
      wallet_addresses.id_social_username AS idSocialUsername,
      game_data.id AS idGameData,
      wallet_addresses.wallet_address AS walletAddress,
      wallet_addresses.balance,
      social_usernames.twitter_username AS twitterUsername,
      social_usernames.telegram_username AS telegramUsername,
      game_data.current_lives AS currentLives,
      game_data.current_level AS currentLevel
    FROM wallet_addresses
    LEFT JOIN social_usernames ON wallet_addresses.id_social_username = social_usernames.id
    LEFT JOIN game_data ON wallet_addresses.id = game_data.id_wallet_address
    WHERE wallet_addresses.wallet_address = '${walletAddress}'
  `))[0];

  if (userdata) {
    return res.status(200).send(userdata);
  } else {
    return res.status(400).send(EMPTY_STRING);
  }
};

/**
 * Register a new user and respond registered his data
 * @param {*} req request from frontend
 * @param {*} res response to backend
 * @returns response object
 */
exports.registerUser = async (req, res) => {
  let idSocialUsername = 0;
  let idWalletAddress = 0;

  const { walletAddress, balance, twitterUsername, telegramUsername } = req.body;

  //  Insert the usernames of twitter and telegram
  const insertedSocialUsernameData = (await db.query(`
    INSERT INTO social_usernames (twitter_username, telegram_username)
    VALUES ('${twitterUsername}', '${telegramUsername}')
  `));
  idSocialUsername = insertedSocialUsernameData.insertId;

  //  Insert the wallet address
  const insertedWalletAddressData = (await db.query(`
    INSERT INTO wallet_addresses (wallet_address, balance, id_social_username)
    VALUES ('${walletAddress}', '${balance}', ${idSocialUsername})
  `));
  idWalletAddress = insertedWalletAddressData.insertId;

  //  Insert game data
  const insertedGameData = (await db.query(`
    INSERT INTO game_data (current_lives, current_level, id_wallet_address)
    VALUES (${0}, ${0}, ${idWalletAddress})
  `));
  idGameData = insertedGameData.insertId;

  return res.status(200).json({
    idWalletAddress,
    idSocialUsername,
    idGameData,
    walletAddress,
    balance,
    twitterUsername,
    telegramUsername,
    currentLives: 0,
    currentLevel: 0
  });
};