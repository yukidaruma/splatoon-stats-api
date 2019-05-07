const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const config = require('../config');
const { db } = require('./db');
const { calculateStartTimeFromLeagueDate } = require('./util');
const { findRuleId, rankedRules } = require('./data');

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

app.get('/league/players/:playerId([\\da-f]{16})', (req, res) => {
  const { playerId } = req.params;

  db
    .select('*')
    .from('league_rankings')
    .where('player_id', playerId)
    .orderBy('league_rankings.start_time', 'asc')
    .join('league_schedules', 'league_rankings.start_time', '=', 'league_schedules.start_time')
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

const weaponRankingRouterCallback = (req, res) => {
  const {
    rankingType, weaponType, year, month, rule,
  } = req.params;

  const tableName = `${rankingType}_rankings`;
  const ruleId = rule ? findRuleId(rule) : 0;

  if (weaponType === 'weapons') {
    db.raw(`
      with popular_weapons as (
        select
            -- Group identical weapons (e.g. Hero Shot Replica and Splattershot)
            case
              when weapons.reskin_of is NOT NULL then weapons.reskin_of
              else :tableName:.weapon_id
            end as temp_weapon_id,
            count(:tableName:.weapon_id),
            sub_weapon_id,
            special_weapon_id
        from :tableName:
          inner join weapons on :tableName:.weapon_id = weapons.weapon_id
          ${rankingType !== 'league' ? '-- ' : ''}inner join league_schedules on :tableName:.start_time = league_schedules.start_time
          where
            (
              :ruleId = 0
              OR
              :ruleId = ${rankingType === 'league' ? 'league_schedules' : tableName}.rule_id
            )
            AND
            (
              extract(year from :tableName:.start_time) = :year
              AND
              extract(month from :tableName:.start_time) = :month
            )
          group by temp_weapon_id, sub_weapon_id, special_weapon_id
          order by count desc, temp_weapon_id desc
      )
      select
          RANK() over (order by popular_weapons.count desc),
          count,
          popular_weapons.temp_weapon_id as weapon_id,
          sub_weapon_id,
          special_weapon_id,
          100 * count / sum(count) over () as percentage
        from popular_weapons`, { tableName, year, month, ruleId })
      .then((result) => {
        res.json(result.rows);
      });
  } else if (weaponType === 'specials' || weaponType === 'subs') {
    // e.g.) specials -> special_weapon_id
    const weaponTypeColumnName = `${weaponType.substring(0, weaponType.length - 1)}_weapon_id`;
    db.raw(`
      with popular_weapons as (
        select
            count(weapons.:weaponTypeColumnName:),
            weapons.:weaponTypeColumnName:
          from :tableName:
            inner join weapons on :tableName:.weapon_id = weapons.weapon_id
            ${rankingType !== 'league' ? '-- ' : ''}inner join league_schedules on :tableName:.start_time = league_schedules.start_time
            WHERE
              (
                :ruleId = 0
                OR
                :ruleId = ${rankingType === 'league' ? 'league_schedules' : tableName}.rule_id
              )
              AND
              (
                extract(year from :tableName:.start_time) = :year
                AND
                extract(month from :tableName:.start_time) = :month
              )
            group by weapons.:weaponTypeColumnName:
            order by count desc, weapons.:weaponTypeColumnName: desc
      )
      select
        rank() over (order by popular_weapons.count desc),
        :weaponTypeColumnName:,
        count,
        100 * count / sum(count) over () as percentage
      from popular_weapons`,
    {
      tableName, weaponTypeColumnName, year, month, ruleId,
    })
      .then((result) => {
        res.json(result.rows);
      });
  } else { // Theoretically this block is unreachable.
    res.status(422).send('Bad type');
  }
};

const rulesPattern = rankedRules.map(rule => rule.key).join('|');

app.get('/:rankingType((league|x))/:weaponType((weapons|specials|subs))/:year(\\d{4})/:month([1-9]|1[012])', weaponRankingRouterCallback);
app.get(`/:rankingType((league|x))/:weaponType((weapons|specials|subs))/:year(\\d{4})/:month([1-9]|1[012])/:rule(${rulesPattern})`, weaponRankingRouterCallback);

module.exports = app;
