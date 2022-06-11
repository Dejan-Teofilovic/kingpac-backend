const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const {
  EMPTY_STRING,
  ADDRESS_OF_REWARD_POOL,
  SCAN_API_KEY,
  ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS,
  DEFAULT_USERS,
  JWT_SECRET_KEY
} = require("../utils/constants");
const db = require("../utils/db");
const {
  groupBy,
  get2RandomIntegers,
  getRandomCompletedLevel,
  checkWalletAddressExistence
} = require('../utils/functions');

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
      game_data.current_level AS currentLevel,
      game_data.completed_max_level AS completedMaxLevel
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
      INSERT INTO game_data (current_lives, current_level, completed_max_level, id_wallet_address)
      VALUES (${0}, ${0}, ${0}, ${idWalletAddress});
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
      currentLevel: 0,
      completed_max_level: 0
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
  try {
    //  Get the winners of last week
    const winnersOfLastWeek = await db.query(`SELECT * FROM winners_of_this_week;`);

    //  Delete all records from the tables 'winners_of_this_week' and 'winners_of_last_week'
    await db.query(`DELETE FROM winners_of_this_week;`);
    await db.query(`DELETE FROM winners_of_last_week;`);
    await db.query('ALTER TABLE winners_of_this_week AUTO_INCREMENT = 1;');
    await db.query('ALTER TABLE winners_of_last_week AUTO_INCREMENT = 1;');

    //  Insert winners of last week into table 'winners_of_last_week'
    if (winnersOfLastWeek.length > 0) {
      (async () => {
        let insertQueryOfLastWeek = 'INSERT INTO winners_of_last_week (id_wallet_address, id_social_username, winners_of_last_week.rank, reward, balance, completed_level) VALUES';
        for (let i = 0; i < winnersOfLastWeek.length; i += 1) {
          let { id_wallet_address, id_social_username, rank, reward, completed_level, balance } = winnersOfLastWeek[i];
          insertQueryOfLastWeek += `(${id_wallet_address}, ${id_social_username}, ${rank}, ${reward}, ${balance}, ${completed_level}), `;
        }
        insertQueryOfLastWeek = insertQueryOfLastWeek.substring(0, insertQueryOfLastWeek.length - 2);
        await db.query(insertQueryOfLastWeek);
      })();
    }

    await db.query(`
      UPDATE game_data SET current_lives = 0, current_level = 0, completed_max_level = 0;
    `);

    if (res) {
      return res.status(201).send(EMPTY_STRING);
    }
    console.log('# saveWinners => ', true);
    return true;
  } catch (error) {
    console.log('# saveWinners.error => ', error);
    if (res) {
      return res.status(500).send(EMPTY_STRING);
    }
    console.log('# saveWinners => ', false);
    return false;
  }
};

/**
 * Update winners of this week
 * @param {object} req Request object from frontend
 * @param {object} res Response object to frontend
 * @returns Response object to frontend
 */
exports.updateWinnersOfThisWeek = async (req, res) => {
  let balanceOfRewardPool = 0;
  console.log('# updateWinnersOfThisWeek');
  try {
    //  Get the winners of this week
    const winnersOfThisWeek = (await db.query(`
      SELECT 
        game_data.id_wallet_address,
        wallet_addresses.id_social_username,
        wallet_addresses.balance,
        game_data.completed_max_level
      FROM wallet_addresses
      LEFT JOIN game_data ON wallet_addresses.id = game_data.id_wallet_address
      WHERE wallet_addresses.id != 1 
        AND wallet_addresses.id != 2 
        AND game_data.completed_max_level > 0
      ORDER BY game_data.completed_max_level DESC, game_data.completed_max_level DESC
      LIMIT 0, 13;
    `));

    //  Get the percentages of reward by rank
    const rewardPercentages = await db.query(`SELECT * FROM rank_reward;`);

    //  Get the balance of reward pool
    const balanceDataOfRewardPool = await (await fetch(`https://api.bscscan.com/api?module=account&action=balance&address=${ADDRESS_OF_REWARD_POOL}&tag=latest&apikey=${SCAN_API_KEY}`)).json();
    balanceOfRewardPool = Number(balanceDataOfRewardPool.result) * 10 ** -18;

    //  Insert winners of this week into table 'winners_of_this_week'
    let insertQueryOfThisWeek = 'INSERT INTO winners_of_this_week (id_wallet_address, id_social_username, winners_of_this_week.rank, reward, balance, completed_level) VALUES';

    /* ================= Insert the default winners into winnersOfThisWeek ================ */

    //  Get random order of id_wallet_addresses of default winners
    const randomIdWalletAddress = await get2RandomIntegers(
      ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS[0],
      ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS[1]
    );
    let randomRanks = 0;

    //  Get 2 different random ranks between top 5
    if (winnersOfThisWeek.length < 5) {
      //  If the number of all winners is less than 5.
      if (winnersOfThisWeek.length > 2) {
        console.log('winnersOfThisWeek.length > 1');
        randomRanks = await get2RandomIntegers(0, winnersOfThisWeek.length - 1);
        console.log('# randomRanks => ', randomRanks);
      } else if (winnersOfThisWeek.length == 2) {
        randomRanks = [0, 1];
      } else if (winnersOfThisWeek.length == 1) {
        console.log('winnersOfThisWeek.length == 1');
        /* ===================== If the number of real winner is 1 ===================== */
        //  Give the default winners their data randomly
        for (let i = 0; i < ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS.length; i += 1) {
          let walletAddressData = null;
          let winner = {};

          //  id_wallet_address
          winner.id_wallet_address = randomIdWalletAddress[i];

          walletAddressData = (await db.query(`
            SELECT balance, id_social_username
            FROM wallet_addresses WHERE id = ${winner.id_wallet_address};
          `))[0];

          //  id_social_username
          winner.id_social_username = walletAddressData.id_social_username;

          //  balance
          winner.balance = walletAddressData.balance;

          //  completed_level
          winner.completed_max_level = winnersOfThisWeek[0].completed_max_level + i + 1;

          winnersOfThisWeek.splice(0, 0, winner);
        }

        winnersOfThisWeek.forEach((element, i) => {
          let {
            id_wallet_address,
            id_social_username,
            balance,
            completed_max_level
          } = element;

          let reward = rewardPercentages[i].reward_percentage * balanceOfRewardPool / 100;

          insertQueryOfThisWeek += `(${id_wallet_address}, ${id_social_username}, ${i + 1}, ${Number(reward.toFixed(2))}, ${balance}, ${completed_max_level}), `;
        });

        insertQueryOfThisWeek = insertQueryOfThisWeek.substring(0, insertQueryOfThisWeek.length - 2);
        //  Delete all records from the tables 'winners_of_this_week' and 'winners_of_last_week'
        await db.query(`DELETE FROM winners_of_this_week;`);
        await db.query('ALTER TABLE winners_of_this_week AUTO_INCREMENT = 1;');

        //  Insert new winners
        await db.query(insertQueryOfThisWeek);

        if (res) {
          console.log('# return true');
          return res.status(201).send(EMPTY_STRING);
        } else {
          console.log('# return true');
          return true;
        }
        /* ============================================================================== */

      } else {
        console.log('# res');
        //  Delete all records from the tables 'winners_of_this_week' and 'winners_of_last_week'
        await db.query(`DELETE FROM winners_of_this_week;`);
        if (res) {
          console.log('# return res.status');
          return res.status(201).send(EMPTY_STRING);
        } else {
          console.log('# return true');
          return true;
        }
      }
    } else {
      //  Else
      randomRanks = await get2RandomIntegers(0, 4);
    }

    //  Give the default winners their data randomly
    for (let i = 0; i < ID_WALLET_ADDRESS_OF_DEFAULT_WINNERS.length; i += 1) {
      let walletAddressData = null;
      let winner = {};

      //  id_wallet_address
      winner.id_wallet_address = randomIdWalletAddress[i];

      walletAddressData = (await db.query(`
        SELECT balance, id_social_username
        FROM wallet_addresses WHERE id = ${winner.id_wallet_address};
      `))[0];

      //  id_social_username
      winner.id_social_username = walletAddressData.id_social_username;

      //  balance
      winner.balance = walletAddressData.balance;

      //  completed_level
      winner.completed_max_level = await getRandomCompletedLevel(randomRanks[i], winnersOfThisWeek);

      winnersOfThisWeek.splice(randomRanks[i], 0, winner);
    }

    /* ==================================================================================== */

    //  Attach the reward percentage of each winner
    winnersOfThisWeek.forEach((element, index) => {
      element.rank = index + 1;
      element.rewardPercentage = rewardPercentages[index].reward_percentage;
    });

    const winnersOfThisWeekByCompletedMaxLevel = groupBy(winnersOfThisWeek, "completed_max_level");

    for (element in winnersOfThisWeekByCompletedMaxLevel) {
      let sumOfRewardPercentages = 0;
      let averageReward = 0;

      winnersOfThisWeekByCompletedMaxLevel[element].forEach(_element => {
        sumOfRewardPercentages += _element.rewardPercentage;
      });

      averageReward = balanceOfRewardPool * (sumOfRewardPercentages / winnersOfThisWeekByCompletedMaxLevel[element].length) / 100;

      winnersOfThisWeekByCompletedMaxLevel[element].forEach(_element => {
        let {
          id_wallet_address,
          id_social_username,
          balance,
          completed_max_level,
          rank
        } = _element;

        insertQueryOfThisWeek += `(${id_wallet_address}, ${id_social_username}, ${rank}, ${Number(averageReward.toFixed(2))}, ${balance}, ${completed_max_level}), `;
      });
    }

    // for (let i = 0; i < winnersOfThisWeek.length; i += 1) {
    //   let reward = 0;
    //   let { id_wallet_address, id_social_username, balance, completed_max_level, rank } = winnersOfThisWeek[i];
    //   let { reward_percentage } = rewardPercentages[i];
    //   reward = balanceOfRewardPool * reward_percentage / 100;
    //   insertQueryOfThisWeek += `(${id_wallet_address}, ${id_social_username}, ${rank}, ${Number(reward.toFixed(2))}, ${balance}, ${completed_max_level}), `;
    // }
    insertQueryOfThisWeek = insertQueryOfThisWeek.substring(0, insertQueryOfThisWeek.length - 2);
    //  Delete all records from the tables 'winners_of_this_week' and 'winners_of_last_week'
    await db.query(`DELETE FROM winners_of_this_week;`);
    await db.query('ALTER TABLE winners_of_this_week AUTO_INCREMENT = 1;');

    await db.query(insertQueryOfThisWeek);

    console.log('# updateWinnersOfThisWeek => ', true);

    if (res) {
      return res.status(201).send(EMPTY_STRING);
    } else {
      return true;
    }
  } catch (error) {
    console.log('# updateWinnersOfThisWeek.error => ', error);
    console.log('# updateWinnersOfThisWeek => ', false);

    if (res) {
      return res.status(500).send(EMPTY_STRING);
    } else {
      return false;
    }
  }
};

/**
 * Get winners of this week or last one
 * @param {*} req Request from frontend
 * @param {*} res Response to frontend
 * @returns Response object
 */
exports.getWinners = async (req, res) => {
  console.log('# get Winners');
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
      LEFT JOIN social_usernames ON winners_of_this_week.id_social_username = social_usernames.id
      ORDER BY winners_of_this_week.rank ASC, winners_of_this_week.balance DESC;
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
      LEFT JOIN social_usernames ON winners_of_last_week.id_social_username = social_usernames.id
      ORDER BY winners_of_last_week.rank ASC, winners_of_last_week.balance DESC;;
    `));
    return res.status(200).send({ winnersOfThisWeek, winnersOfLastWeek });
  } catch (error) {
    console.log('# getWinners error => ', error);
    return res.status(500).send(EMPTY_STRING);
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
exports.saveDefaultUsers = async () => {
  for (let i = 0; i < DEFAULT_USERS.length; i += 1) {
    let idSocialUsername = 0;
    let idWalletAddress = 0;
    let { walletAddress, twitterUsername, telegramUsername } = DEFAULT_USERS[i];
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
        INSERT INTO game_data (current_lives, current_level, completed_max_level, id_wallet_address)
        VALUES (${0}, ${0}, ${0}, ${idWalletAddress});
      `);
    }
  }
};

/**
 * Get access token from userdata
 * @param {object} req Request from frontend
 * @param {object} res Response from backend
 * @returns Access token
 */
exports.getAccessToken = async (req, res) => {
  const { idWalletAddress, idSocialUsername } = req.body;

  try {
    const userdata = (await db.query(`
      SELECT 
        game_data.id_wallet_address AS idWalletAddress,
        game_data.id AS idGameData,
        wallet_addresses.wallet_address AS walletAddress,
        social_usernames.twitter_username AS twitterUsername,
        social_usernames.telegram_username AS telegramUsername,
        game_data.current_lives AS currentLives,
        game_data.current_level AS currentLevel,
        game_data.completed_max_level AS completedMaxLevel
      FROM wallet_addresses
      LEFT JOIN social_usernames ON wallet_addresses.id_social_username = social_usernames.id
      LEFT JOIN game_data ON wallet_addresses.id = game_data.id_wallet_address
      WHERE wallet_addresses.id = '${idWalletAddress}';
    `))[0];

    if (userdata) {
      const payload = {
        userdata: {
          ...userdata,
          idSocialUsername
        }
      };
      jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: '60 seconds' }, (error, accessToken) => {
        if (error) {
          console.log('# error => ', error);
        }
        return res.status(200).send(accessToken);
      });
    } else {
      return res.status(404).send('');
    }
  } catch (error) {
    return res.status(500).send('');
  }
};


