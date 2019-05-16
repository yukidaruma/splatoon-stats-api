const moment = require('moment-timezone');

/**
 * @desc Calculate league date (used in leagueId) from given date.
 * @param {(Number|Date)} startTime
 * @example calculateLeagueDate(1550577600000) === calculateLeagueDate(1550584799999) === '19021912'
 */
const calculateLeagueDate = (startTime) => {
  let startDate;
  if (startTime instanceof Date) {
    startDate = startTime;
  } else {
    startDate = new Date(startTime);
  }

  startDate.setUTCMinutes(0);
  startDate.setUTCSeconds(0);
  if (startDate.getUTCHours() % 2 === 1) {
    startDate.setUTCHours(startDate.getUTCHours() - 1);
  }
  return moment(startDate).tz('UTC').format('YYMMDDHH');
};

/**
 * @desc Inverse function of calculateLeagueDate.
 * @example calculateStartTimeFromLeagueDate(calculateLeagueDate(startTime)) === startTime
 */
const calculateStartTimeFromLeagueDate = leagueDate => moment.utc(leagueDate, 'YYMMDDHH', true).local().valueOf();

/**
 * @desc Convert Date object to SQL timestamp string.
 * @param {(Number|Date)} date
 * @returns {String} SQL timestamp string
 * @example dateToSqlTimestamp(moment({ year: 2018, month: 0 })) === '2018-01-01 00:00:00'
 */
const dateToSqlTimestamp = date => moment(date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');

/**
 * @desc Convert Date object to SQL timestamp string.
 * @param {Number} ms Duration in milliseconds
 * @example await wait(1000); // Wait for 1 second
 */
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  calculateLeagueDate,
  calculateStartTimeFromLeagueDate,
  dateToSqlTimestamp,
  wait,
};
