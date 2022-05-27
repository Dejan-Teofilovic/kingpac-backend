const { EMPTY_STRING, THIS_WEEK, ADDRESS_OF_REWARD_POOL, SCAN_API_KEY, ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS, LIMIT_SCOPE_OF_COMPLETED_LEVEL } = require("../utils/constants");
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
    return res.status(400).send(EMPTY_STRING);
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
        wallet_addresses.balance,
        game_data.current_level
      FROM wallet_addresses
      LEFT JOIN game_data ON wallet_addresses.id = game_data.id_wallet_address
      WHERE wallet_addresses.wallet_address = '${walletAddress}'
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
      //  completed_level
      winnersOfThisWeek[randomRanks[i]].current_level = await getRandomCompletedLevel(randomRanks[i], winnersOfThisWeek);

      //  id_wallet_address
      winnersOfThisWeek[randomRanks[i]].id_wallet_address = randomIdWalletAddress[i];

      //  balance
      winnersOfThisWeek[randomRanks[i]].balance = (await db.query(`
        SELECT balance FROM wallet_addresses WHERE id_wallet_address = ${winnersOfThisWeek[randomRanks[i]].id_wallet_address};
      `))[0].balance;
    }

    /* ==================================================================================== */

    //  Get the winners of last week
    const winnersOfLastWeek = (await db.query(`SELECT * FROM winners_of_this_week;`));

    //  Get the percentages of reward by rank
    const rewardPercentages = (await db.query(`SELECT * FROM rank_reward;`));

    //  Get the balance of reward pool
    const balanceDataOfRewardPool = await (await fetch(`https://api.bscscan.com/api?module=account&action=balance&address=${ADDRESS_OF_REWARD_POOL}&tag=latest&apikey=${SCAN_API_KEY}`)).json();
    balanceOfRewardPool = Number(balanceDataOfRewardPool.result);

    //  Delete all records from the tables 'winners_of_this_week' and 'winners_of_last_week'
    await db.query(`DELETE FROM winners_of_this_week;`);
    await db.query(`DELETE FROM winners_of_last_week;`);

    //  Insert winners of last week into table 'winners_of_last_week'
    for (let i = 0; i < winnersOfLastWeek.length; i += 1) {
      let { id_wallet_address, rank, reward, completed_level, balance } = winnersOfLastWeek[i];
      await db.query(`
        INSERT INTO winners_of_last_week (id_wallet_address, rank, reward, completed_level, balance)
        VALUES (${id_wallet_address}, ${rank}, ${reward}, ${completed_level}, ${balance});
      `);
    }

    //  Insert winners of this week into table 'winners_of_this_week'
    for (let i = 0; i < winnersOfThisWeek.length; i += 1) {
      let reward = 0;
      let { id_wallet_address, balance, current_level } = winnersOfThisWeek[i];
      let { rewardPercentage } = rewardPercentages[i];

      reward = balanceOfRewardPool * rewardPercentage / 100;
      await db.query(`
        INSERT INTO winners_of_this_week (id_wallet_address, rank, reward, completed_level, balance)
        VALUES(${id_wallet_address}, ${i + 1}, ${Number(reward.toFixed(2))}, ${current_level}, ${balance});
      `);
    }

    return res.status(200).send('')
  } catch (error) {
    return res.status(500).send('');
  }
};

/**
 * Get 2 random ranks between "min" and "max"
 * @param {*} min The minimum value of random scope
 * @param {*} max The maximum value of random scope
 * @returns 2 random intergers between "min" and "max"
 */
const get2RandomIntegers = (min = 0, max) => {
  let randomInteger1 = min + 1;
  let randomInteger2 = min + 1;
  let comparisonTarget = Math.floor(Math.random() * (max - min + 1)) + min;

  do {
    randomInteger1 = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (randomInteger1 === comparisonTarget);

  do {
    randomInteger2 = Math.floor(Math.random() * max);
  } while (randomInteger2 === comparisonTarget || randomInteger2 === randomInteger1);

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
    let { completed_level } = winnersOfThisWeek[0];

    //  Get random completed_level
    completedLevel = Math.floor(
      Math.random() * (completed_level + LIMIT_SCOPE_OF_COMPLETED_LEVEL - completed_level + 1)
    ) + completed_level;
  } else {
    let maxCompletedLevel = winnersOfThisWeek[randomRank - 1].completed_level;
    let minCompletedLevel = winnersOfThisWeek[randomRank + 1].completed_level;

    completedLevel = Math.floor(
      Math.random() * (maxCompletedLevel - minCompletedLevel + 1)
    ) + minCompletedLevel;
  }

  return completedLevel;
};
