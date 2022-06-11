const { LIMIT_SCOPE_OF_COMPLETED_LEVEL } = require("./constants");
const db = require("./db");

exports.groupBy = (arr, criteria) => {
  const newObj = arr.reduce(function (acc, currentValue) {
    if (!acc[currentValue[criteria]]) {
      acc[currentValue[criteria]] = [];
    }
    acc[currentValue[criteria]].push(currentValue);
    return acc;
  }, {});
  return newObj;
};

/**
 * Get 2 random ranks between "min" and "max"
 * @param {*} min The minimum value of random scope
 * @param {*} max The maximum value of random scope
 * @returns 2 random intergers between "min" and "max"
 */
exports.get2RandomIntegers = (min = 0, max) => {
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
exports.getRandomCompletedLevel = (randomRank, winnersOfThisWeek) => {
  let completedLevel = 0;
  // Math.floor(Math.random() * (max - min + 1)) + min;

  if (randomRank == 0) {
    let { completed_max_level } = winnersOfThisWeek[0];

    //  Get random completed_max_level
    completedLevel = Math.floor(
      Math.random() * (completed_max_level + LIMIT_SCOPE_OF_COMPLETED_LEVEL - completed_max_level + 1)
    ) + completed_max_level;
  } else {
    let maxCompletedLevel = winnersOfThisWeek[randomRank - 1].completed_max_level;
    let minCompletedLevel = winnersOfThisWeek[randomRank].completed_max_level;

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
exports.checkWalletAddressExistence = async (walletAddress) => {
  const walletInfo = await (await db.query(`
    SELECT * FROM wallet_addresses WHERE wallet_address = '${walletAddress}'
  `))[0];

  if (walletInfo) {
    return true;
  } else {
    return false;
  }
};