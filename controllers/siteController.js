const fetch = require('node-fetch');
const {
  EMPTY_STRING,
  ADDRESS_OF_REWARD_POOL,
  SCAN_API_KEY,
  ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS,
  LIMIT_SCOPE_OF_COMPLETED_LEVEL,
  DEFAULT_WINNERS
} = require("../utils/constants");
const db = require("../utils/db");

/**
 * Get userdata
 * @param {*} req Request from frontend
 * @param {*} res Response to frontend
 * @returns Response object
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
    WHERE wallet_addresses.wallet_address = '${walletAddress}';
  `))[0];

  if (userdata) {
    return res.status(200).send(userdata);
  } else {
    return res.status(404).send(EMPTY_STRING);
  }
};

/**
 * Register a new user and respond registered his data
 * @param {*} req Request from frontend
 * @param {*} res Response to frontend
 * @returns Response object
 */
exports.registerUser = async (req, res) => {
  let idSocialUsername = 0;
  let idWalletAddress = 0;
  const { walletAddress, balance, twitterUsername, telegramUsername } = req.body;
  const walletExisted = await checkWalletAddressExistence(walletAddress);

  if (walletExisted) {
    return res.status(400).send('');
  } else {
    //  Insert the usernames of twitter and telegram
    const insertedSocialUsernameData = (await db.query(`
      INSERT INTO social_usernames (twitter_username, telegram_username)
      VALUES ('${twitterUsername}', '${telegramUsername}');
    `));
    idSocialUsername = insertedSocialUsernameData.insertId;

    //  Insert the wallet address
    const insertedWalletAddressData = (await db.query(`
      INSERT INTO wallet_addresses (wallet_address, balance, id_social_username)
      VALUES ('${walletAddress}', '${balance}', ${idSocialUsername});
    `));
    idWalletAddress = insertedWalletAddressData.insertId;

    //  Insert game data
    const insertedGameData = (await db.query(`
      INSERT INTO game_data (current_lives, current_level, id_wallet_address)
      VALUES (${0}, ${0}, ${idWalletAddress});
    `));
    idGameData = insertedGameData.insertId;

    return res.status(201).json({
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
  }
};

/**
 * Save winners of this week and update winners of last week
 * @param {*} req Request from frontend
 * @param {*} res Response to frontend
 * @returns Response object
 */
exports.saveWinners = async (req, res) => {
  let balanceOfRewardPool = 0;
  try {
    //  Get the winners of this week
    const winnersOfThisWeek = (await db.query(`
      SELECT 
        game_data.id_wallet_address,
        wallet_addresses.id_social_username,
        wallet_addresses.balance,
        game_data.current_level
      FROM wallet_addresses
      LEFT JOIN game_data ON wallet_addresses.id = game_data.id_wallet_address
      ORDER BY game_data.current_level DESC, game_data.current_level DESC
      LIMIT 0, 13;
    `));

    /* ================= Insert the default winners into winnersOfThisWeek ================ */

    //  Get 2 different random ranks between 0 and 4
    const randomRanks = await get2RandomIntegers(0, 4);

    //  Get random order of id_wallet_addresses of default winners
    const randomIdWalletAddress = await get2RandomIntegers(
      ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS[0],
      ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS[1]
    );

    //  Give the default winners their data randomly
    for (let i = 0; i < ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS.length; i += 1) {
      let walletAddressData = null;

      //  completed_level
      winnersOfThisWeek[randomRanks[i]].current_level = await getRandomCompletedLevel(randomRanks[i], winnersOfThisWeek);

      //  id_wallet_address
      winnersOfThisWeek[randomRanks[i]].id_wallet_address = randomIdWalletAddress[i];

      walletAddressData = (await db.query(`
        SELECT balance, id_social_username
        FROM wallet_addresses WHERE id = ${winnersOfThisWeek[randomRanks[i]].id_wallet_address};
      `))[0];

      //  id_social_username
      winnersOfThisWeek[randomRanks[i]].id_social_username = walletAddressData.id_social_username;

      //  balance
      winnersOfThisWeek[randomRanks[i]].balance = walletAddressData.balance;
    }

    /* ==================================================================================== */

    //  Get the winners of last week
    const winnersOfLastWeek = (await db.query(`SELECT * FROM winners_of_this_week;`));

    //  Get the percentages of reward by rank
    const rewardPercentages = await db.query(`SELECT * FROM rank_reward;`);

    //  Get the balance of reward pool
    const balanceDataOfRewardPool = await (await fetch(`https://api.bscscan.com/api?module=account&action=balance&address=${ADDRESS_OF_REWARD_POOL}&tag=latest&apikey=${SCAN_API_KEY}`)).json();
    balanceOfRewardPool = Number(balanceDataOfRewardPool.result);

    //  Delete all records from the tables 'winners_of_this_week' and 'winners_of_last_week'
    await db.query(`DELETE FROM winners_of_this_week;`);
    await db.query(`DELETE FROM winners_of_last_week;`);

    if (winnersOfLastWeek.length > 0) {
      //  Insert winners of last week into table 'winners_of_last_week'
      for (let i = 0; i < winnersOfLastWeek.length; i += 1) {
        let { id_wallet_address, id_social_username, rank, reward, completed_level, balance } = winnersOfLastWeek[i];
        await db.query(`
          INSERT INTO winners_of_last_week (id_wallet_address, id_social_username, winners_of_last_week.rank, reward, balance, completed_level)
          VALUES (${id_wallet_address}, ${id_social_username}, ${rank}, ${reward}, ${balance}, ${completed_level});
        `);
      }
    }

    //  Insert winners of this week into table 'winners_of_this_week'
    for (let i = 0; i < winnersOfThisWeek.length; i += 1) {
      let reward = 0;
      let { id_wallet_address, id_social_username, balance, current_level } = winnersOfThisWeek[i];
      let { reward_percentage } = rewardPercentages[i];
      reward = balanceOfRewardPool * reward_percentage / 100;
      await db.query(`
        INSERT INTO winners_of_this_week (id_wallet_address, id_social_username, winners_of_this_week.rank, reward, balance, completed_level)
        VALUES(${id_wallet_address}, ${id_social_username}, ${i + 1}, ${Number(reward.toFixed(2))}, ${balance}, ${current_level - 1});
      `);
    }

    return res.status(201).send('');
  } catch (error) {
    return res.status(500).send('');
  }
};

/**
 * Get winners of this week or last one
 * @param {*} req Request from frontend
 * @param {*} res Response to frontend
 * @returns Response object
 */
exports.getWinners = async (req, res) => {
  try {
    let winnersOfThisWeek = null;
    let winnersOfLastWeek = null;

    winnersOfThisWeek = (await db.query(`
      SELECT
        winners_of_this_week.rank, 
        wallet_addresses.wallet_address AS walletAddress,
        social_usernames.twitter_username AS twitterUsername,
        social_usernames.telegram_username AS telegramUsername,
        winners_of_this_week.balance,
        winners_of_this_week.reward,
        winners_of_this_week.completed_level AS completedLevel
      FROM winners_of_this_week
      LEFT JOIN wallet_addresses ON winners_of_this_week.id_wallet_address = wallet_addresses.id
      LEFT JOIN social_usernames ON winners_of_this_week.id_social_username = social_usernames.id;
    `));
    winnersOfLastWeek = (await db.query(`
      SELECT
        winners_of_last_week.rank, 
        wallet_addresses.wallet_address AS walletAddress,
        social_usernames.twitter_username AS twitterUsername,
        social_usernames.telegram_username AS telegramUsername,
        winners_of_last_week.balance,
        winners_of_last_week.reward,
        winners_of_last_week.completed_level AS completedLevel
      FROM winners_of_last_week
      LEFT JOIN wallet_addresses ON winners_of_last_week.id_wallet_address = wallet_addresses.id
      LEFT JOIN social_usernames ON winners_of_last_week.id_social_username = social_usernames.id;
    `));
    return res.status(200).send({ winnersOfThisWeek, winnersOfLastWeek });
  } catch (error) {
    return res.status(500).send('');
  }
};

/**
 * Update balance of wallet_addresses
 * @param {*} req Request from frontend
 * @param {*} res Response to frontend
 */
exports.updateBalance = async (req, res) => {
  const { idWalletAddress } = req.params;
  const { balance } = req.body;

  db.query(`
    UPDATE wallet_addresses SET balance = ${balance} WHERE id = ${idWalletAddress};
  `, (error) => {
    if (error) {
      return res.status(501).send(EMPTY_STRING);
    } else {
      return res.status(200).send(EMPTY_STRING);
    }
  });
};

/** Save default winners - secret */
exports.saveDefaultWinners = async () => {
  for (let i = 0; i < DEFAULT_WINNERS.length; i += 1) {
    let idSocialUsername = 0;
    let idWalletAddress = 0;
    let { walletAddress, twitterUsername, telegramUsername } = DEFAULT_WINNERS[i];
    let balance = 5000000;

    //  Check whether the default winner was already existed in DB or not.
    let walletExisted = await checkWalletAddressExistence(walletAddress);

    if (!walletExisted) {
      //  Insert the usernames of twitter and telegram
      let insertedSocialUsernameData = (await db.query(`
        INSERT INTO social_usernames (twitter_username, telegram_username)
        VALUES ('${twitterUsername}', '${telegramUsername}');
      `));
      idSocialUsername = insertedSocialUsernameData.insertId;

      //  Insert the wallet address
      let insertedWalletAddressData = (await db.query(`
        INSERT INTO wallet_addresses (wallet_address, balance, id_social_username)
        VALUES ('${walletAddress}', '${balance}', ${idSocialUsername});
      `));
      idWalletAddress = insertedWalletAddressData.insertId;

      //  Insert game data
      await db.query(`
        INSERT INTO game_data (current_lives, current_level, id_wallet_address)
        VALUES (${0}, ${0}, ${idWalletAddress});
      `);
    }
  }
};

/**
 * Get 2 random ranks between "min" and "max"
 * @param {*} min The minimum value of random scope
 * @param {*} max The maximum value of random scope
 * @returns 2 random intergers between "min" and "max"
 */
const get2RandomIntegers = (min = 0, max) => {
  let randomInteger1 = 0;
  let randomInteger2 = 0;

  randomInteger1 = Math.floor(Math.random() * (max - min + 1)) + min;
  do {
    randomInteger2 = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (randomInteger2 === randomInteger1 || randomInteger2 < 1);

  return [randomInteger1, randomInteger2];
};

/**
 * Get random completed level of randomRank
 * @param {*} randomRank Rank that was generated by random
 * @param {*} winnersOfThisWeek Winners of this week
 * @returns A Random completed level
 */
const getRandomCompletedLevel = (randomRank, winnersOfThisWeek) => {
  let completedLevel = 0;
  // Math.floor(Math.random() * (max - min + 1)) + min;

  if (randomRank == 0) {
    let { current_level } = winnersOfThisWeek[0];

    //  Get random current_level
    completedLevel = Math.floor(
      Math.random() * (current_level + LIMIT_SCOPE_OF_COMPLETED_LEVEL - current_level + 1)
    ) + current_level;
  } else {
    let maxCompletedLevel = winnersOfThisWeek[randomRank - 1].current_level;
    let minCompletedLevel = winnersOfThisWeek[randomRank + 1].current_level;

    completedLevel = Math.floor(
      Math.random() * (maxCompletedLevel - minCompletedLevel + 1)
    ) + minCompletedLevel;
  }
  return completedLevel;
};

/**
 * Check whether the default winner was already existed in DB or not.
 * @param {string} walletAddress The address of a wallet
 * @returns Boolean value - If that wallet is existed in DB, the return value is true. Else, false
 */
const checkWalletAddressExistence = async (walletAddress) => {
  const walletInfo = await (await db.query(`
    SELECT * FROM wallet_addresses WHERE wallet_address = '${walletAddress}'
  `))[0];

  if (walletInfo) {
    return true;
  } else {
    return false;
  }
};