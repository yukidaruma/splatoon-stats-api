const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const moment = require('moment-timezone');

const config = require('../config');
const { db } = require('./db');
const { calculateStartTimeFromLeagueDate, dateToSqlTimestamp } = require('./util');
const { findRuleId, rankedRules } = require('./data');
const { queryWeaponRanking } = require('./query');

const app = express();

app.use(cors({
  origin: config.FRONTEND_ORIGIN,
}));

// Logging middleware
const logFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'short';
app.use(morgan(logFormat));

// Serve static files
app.use('/static', express.static('cache'));

app.get('/', (req, res) => {
  res.send('It works.');
});

app.get('/players/:rankingType(league|x)/:playerId([\\da-f]{16})', (req, res) => {
  const { rankingType, playerId } = req.params;

  const tableName = `${rankingType}_rankings`;

  let query = db
    .select('*')
    .from(tableName)
    .where('player_id', playerId)
    .orderBy(`${tableName}.start_time`, 'desc');

  if (rankingType === 'x') {
    query = query.orderBy('rule_id', 'asc');
  } else if (rankingType === 'league') {
    query = query
      .orderBy('group_type', 'asc') // Always T -> P
      .join('league_schedules', 'league_rankings.start_time', '=', 'league_schedules.start_time');
  }

  query.then((rows) => {
    res.json(rows);
  });
});

app.get('/rankings/x/:year(\\d{4})/:month([1-9]|1[0-2])/:ruleKey([a-z_]+)', (req, res) => {
  const { year, month, ruleKey } = req.params;

  const ruleId = findRuleId(ruleKey);
  const startTime = moment.utc({ year, month: month - 1 });

  db
    .select(['player_id', 'weapon_id', 'rank', 'rating'])
    .from('x_rankings')
    .where('rule_id', ruleId)
    .whereRaw('start_time = to_timestamp(?)', [startTime / 1000])
    .orderBy('rank', 'asc')
    .orderBy('player_id', 'asc')
    .then((rows) => {
      res.json(rows);
    });
});

// eslint-disable-next-line consistent-return
app.get('/league/rankings/:leagueDate(\\d{8}):groupType([TP])', (req, res) => {
  const { leagueDate, groupType } = req.params;

  const startTime = calculateStartTimeFromLeagueDate(leagueDate);

  // Instead of validating, just check if it's a valid date.
  if (Number.isNaN(startTime)) {
    return res.status(422).send('Bad league ID.');
  }

  db
    .select('*')
    .from('league_rankings')
    .whereRaw('start_time = to_timestamp(?) AND group_type = ?', [startTime / 1000, groupType])
    .orderBy('rank', 'asc')
    .orderBy('player_id', 'asc')
    .then((rows) => {
      res.json(rows);
    });
});

const weaponPopularityRouterCallback = (req, res) => {
  const {
    rankingType, weaponType, year, month, rule,
  } = req.params;

  const ruleId = rule ? findRuleId(rule) : 0;

  const startTime = dateToSqlTimestamp(moment.utc({ year, month: month - 1 }));
  const endTime = dateToSqlTimestamp(moment.utc({ year, month }));

  queryWeaponRanking(rankingType, weaponType, startTime, endTime, ruleId)
    .then(ranking => res.json(ranking))
    .catch(err => res.status(500).send(err));
};

const rulesPattern = rankedRules.map(rule => rule.key).join('|');

app.get('/:weaponType(weapons|specials|subs)/:rankingType(league|x)/:year(\\d{4})/:month([1-9]|1[012])', weaponPopularityRouterCallback);
app.get(`/:weaponType(weapons|specials|subs)/:rankingType(league|x)/:year(\\d{4})/:month([1-9]|1[012])/:rule(${rulesPattern})`, weaponPopularityRouterCallback);

module.exports = app;
