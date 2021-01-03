const fs = require('fs');
const moment = require('moment-timezone');

/**
 * @desc Resolve object value by path. Also works on arrays.
 * @param {Object} object
 * @param {Number} path `.` splitted path
 * @example resolveObjectPath({ foo: { bar: 1 } }, 'foo.bar') === 1
 */
const resolveObjectPath = (obj, path) => {
  if (!obj) return undefined;

  return path.split('.').reduce((acc, e) => (acc === undefined ? undefined : acc[e]), obj);
};

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
const calculateStartTimeFromLeagueDate = (leagueDate) => moment.utc(leagueDate, 'YYMMDDHH', true).local().valueOf();

/**
 * @desc Convert Date object to SQL timestamp string.
 * @param {(Number|Date)} date
 * @returns {String} SQL timestamp string
 * @example dateToSqlTimestamp(moment({ year: 2018, month: 0 })) === '2018-01-01 00:00:00'
 */
const dateToSqlTimestamp = (date) => moment(date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');

/**
 * @desc Escape query to be used in LIKE query.
 * @param {String} Query
 * @returns {String} Escaped query
 * @example escapeLikeQuery('1% 2% foo_bar') === '1\\% 2\\% foo\\_bar'
 */
const escapeLikeQuery = (query) => query.replace(/[%_]/g, (m) => `\\${m}`);

/**
 * @desc Get weapon class (defined in weaponClasses in `./data`) by weapon id.
 * **Note that this function returns 'shooter' for unknown weapons.**
 * @param {Number} weaponId
 * @returns {String} weapon class
 * @example getWeaponClassById(0) === 'shooter' // sploosh-o-matic is classified as shooter.
 */
const getWeaponClassById = (weaponId) => {
  if ((weaponId >= 0 && weaponId < 200) || (weaponId >= 300 && weaponId < 1000)) {
    return 'shooter';
  }
  if (weaponId >= 200 && weaponId < 300) {
    return 'blaster';
  }
  if (weaponId >= 1000 && weaponId < 1100) {
    return 'roller';
  }
  if (weaponId >= 1100 && weaponId < 2000) {
    return 'brush';
  }
  if (weaponId >= 2000 && weaponId < 3000) {
    return 'charger';
  }
  if (weaponId >= 3000 && weaponId < 4000) {
    return 'slosher';
  }
  if (weaponId >= 4000 && weaponId < 5000) {
    return 'splatling';
  }
  if (weaponId >= 5000 && weaponId < 6000) {
    return 'maneuver';
  }
  if (weaponId >= 6000 && weaponId < 7000) {
    return 'brella';
  }

  return 'shooter';
};

const i18nCache = new Map();

/**
 * @desc Return localized text.
 * @example i18n('en', 'stages.0.name') === 'The Reef'
 * @param {String} lang language code
 * @param {String} key text key
 * @returns {String} localized text
 */
const i18n = (lang, key) => {
  if (!i18nCache.has(lang)) {
    i18nCache.set(lang, JSON.parse(fs.readFileSync(`cache/locale/${lang}.json`)));
  }

  return resolveObjectPath(i18nCache.get(lang), key);
};

const i18nEn = (key) => i18n('en', key);

/**
 * @desc Return random number between min and max.
 * @param {Number} min
 * @param {Number} max
 */
const randomBetween = (min, max) => Math.random() * (max - min + 1) + min;

/**
 * @param {Number} start
 * @param {Number} stop
 * @param {Number} step
 * @returns {Number[]}
 */
const range = (start, stop, step = 1) =>
  Array(Math.ceil((stop - start) / step))
    .fill(start)
    .map((x, y) => x + y * step);

/**
 * @desc Convert Date object to SQL timestamp string.
 * @param {Number} ms Duration in milliseconds
 * @example await wait(1000); // Wait for 1 second
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @type {AsyncRouteHandler} */
const wrapPromise = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  calculateLeagueDate,
  calculateStartTimeFromLeagueDate,
  dateToSqlTimestamp,
  escapeLikeQuery,
  getWeaponClassById,
  i18n,
  i18nEn,
  randomBetween,
  range,
  resolveObjectPath,
  wait,
  wrapPromise,
};
