const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const moment = require('moment-timezone');

const config = require('../config');
const { db } = require('./db');
const { calculateStartTimeFromLeagueDate, dateToSqlTimestamp } = require('./util');
const { findRuleId, rankedRules } = require('./data');
const { joinLatestName, queryWeaponRanking, queryWeaponTopPlayers } = require('./query');

const app = express();
app.disable('x-powered-by');

app.use(cors({
  origin: config.FRONTEND_ORIGIN,
}));

app.use((req, res, next) => {
  if (req.method === 'GET' && config.GET_REQUEST_CACHE_DURATION) {
    res.setHeader('cache-control', `public, s-maxage=${config.GET_REQUEST_CACHE_DURATION}`);
  }

  next();
});

// Logging middleware
const logFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'short';
app.use(morgan(logFormat));

// Serve static files
app.use('/static', express.static('cache'));

app.get('/', (req, res) => {
  res.send('It works.');
});

app.get('/players/:playerId([\\da-f]{16})/known_names', (req, res) => {
  db
    .select('player_name', 'last_used')
    .from('player_known_names')
    .where('player_id', '=', req.params.playerId)
    .orderBy('last_used', 'desc')
    .orderBy('player_name', 'asc')
    .then(rows => res.send(rows));
});

app.get('/players/:playerId([\\da-f]{16})/rankings/:rankingType(league|x|splatfest)', (req, res) => {
  const { rankingType, playerId } = req.params;

  const tableName = `${rankingType}_rankings`;

  let query;

  if (rankingType === 'league') {
    query = db.raw(`with target_player_league_rankings as (
      select *
        from league_rankings
        where league_rankings.player_id = ?
    )
    select
        *,
        -- You can't create array consists of different types so it convert weapon_id into varchar
        (
          select array_agg(
            array[peer_league_rankings.player_id, peer_league_rankings.weapon_id::varchar, player_names.player_name]
          )
          from league_rankings as peer_league_rankings
          left outer join ??
          where peer_league_rankings.group_id = target_player_league_rankings.group_id
            AND peer_league_rankings.start_time = target_player_league_rankings.start_time
            AND peer_league_rankings.player_id != target_player_league_rankings.player_id
        ) as teammates
      from target_player_league_rankings
      inner join league_schedules on league_schedules.start_time = target_player_league_rankings.start_time
      order by target_player_league_rankings.start_time desc`, [playerId, joinLatestName('peer_league_rankings')])
      .then(queryResult => queryResult.rows.map((row) => {
        if (row.teammates) { // Sometimes data for every other member is missing
          // eslint-disable-next-line no-param-reassign
          row.teammates = row.teammates.map(teammate => ({
            player_id: teammate[0],
            weapon_id: parseInt(teammate[1], 10), // Convert back to Int
            player_name: teammate[2],
          }));
        }
        return row;
      }));
  } else {
    query = db
      .select('*')
      .from(tableName)
      .where('player_id', playerId);

    if (rankingType === 'x') {
      query = query
        .orderBy(`${tableName}.start_time`, 'desc')
        .orderBy('rule_id', 'asc');
    } else if (rankingType === 'splatfest') {
      query = query
        .join('splatfest_schedules', knex => knex
          .on('splatfest_schedules.region', 'splatfest_rankings.region')
          .on('splatfest_schedules.splatfest_id', 'splatfest_rankings.splatfest_id'))
        .orderBy('splatfest_schedules.start_time', 'desc');
    }
  }

  query.then((rows) => {
    res.json(rows);
  });
});

app.get('/players/search', (req, res) => {
  const { name } = req.query;
  db
    .select(['player_id', 'player_name', 'last_used'])
    .from('player_known_names')
    .where('player_name', 'ilike', `%${name}%`)
    .orderBy('last_used', 'desc')
    .orderBy('player_id', 'asc')
    .limit(50)
    .then(rows => res.json(rows));
});

app.get('/rankings/x/:year(\\d{4})/:month([1-9]|1[0-2])/:ruleKey([a-z_]+)', (req, res) => {
  const { year, month, ruleKey } = req.params;

  const ruleId = findRuleId(ruleKey);
  const startTime = moment.utc({ year, month: month - 1 });

  db
    .select(['x_rankings.player_id', 'weapon_id', 'rank', 'rating', 'player_names.player_name'])
    .from('x_rankings')
    .leftOuterJoin(joinLatestName('x_rankings'))
    .where('rule_id', ruleId)
    .whereRaw('start_time = to_timestamp(?)', [startTime.unix()])
    .orderBy('rank', 'asc')
    .orderBy('x_rankings.player_id', 'asc')
    .then((rows) => {
      res.json(rows);
    });
});

// eslint-disable-next-line consistent-return
app.get('/rankings/league/:leagueDate(\\d{8}):groupType([TP])', (req, res) => {
  const { leagueDate, groupType } = req.params;

  const startTime = calculateStartTimeFromLeagueDate(leagueDate);

  // Instead of validating, just check if it's a valid date.
  if (Number.isNaN(startTime)) {
    return res.status(422).send('Bad league ID.');
  }
  db.raw(`
    select
        distinct rank, rating, group_id,
        (select array_agg(array[l2.player_id, l2.weapon_id::varchar, player_names.player_name])
          from league_rankings as l2
          left outer join :joinQuery:
          where l1.group_id = l2.group_id AND start_time = to_timestamp(:startTime)) as group_members
      from league_rankings as l1
      where start_time = to_timestamp(:startTime) AND group_type = :groupType
      order by rank asc`, { startTime: startTime / 1000, groupType, joinQuery: joinLatestName('l2') })
    .then((result) => {
      res.json(result.rows);
    });
});

app.get('/rankings/splatfest/:region((na|eu|jp))/:splatfestId(\\d+)', (req, res) => {
  const { region, splatfestId } = req.params;

  db
    .select('*')
    .from('splatfest_rankings')
    .leftOuterJoin(joinLatestName('splatfest_rankings'))
    .where({ region, splatfest_id: splatfestId })
    .orderBy('rank', 'asc')
    .then(rows => res.json(rows));
});

const weaponPopularityRouterCallback = (req, res) => {
  const {
    rankingType, weaponType, year, month, rule, region, splatfestId,
  } = req.params;

  const ruleId = rule ? findRuleId(rule) : 0;

  const startTime = moment.utc({ year, month: month - 1 });
  const startTimestamp = dateToSqlTimestamp(startTime);
  const endTimestamp = dateToSqlTimestamp(startTime.add({ month: 1 }));

  queryWeaponRanking({
    rankingType, weaponType, startTime: startTimestamp, endTime: endTimestamp, ruleId, region, splatfestId,
  })
    .then(ranking => res.json(ranking))
    .catch(err => res.status(500).send(err));
};

const rulesPattern = rankedRules.map(rule => rule.key).join('|');

app.get('/weapons/:weaponType(weapons|mains|specials|subs)/:rankingType(league|x)/:year(\\d{4})/:month([1-9]|1[012])', weaponPopularityRouterCallback);
app.get(`/weapons/:weaponType(weapons|mains|specials|subs)/:rankingType(league|x)/:year(\\d{4})/:month([1-9]|1[012])/:rule(${rulesPattern})`, weaponPopularityRouterCallback);
app.get('/weapons/:weaponType(weapons|mains|specials|subs)/:rankingType(splatfest)/:region(na|eu|jp)/:splatfestId(\\d+)', weaponPopularityRouterCallback);

app.get('/weapons/x/top-players', (req, res) => {
  db
    .distinct('start_time')
    .from('x_rankings')
    .orderBy('start_time', 'desc')
    .limit(1)
    .then(rows => rows[0] && rows[0].start_time)
    .then((latestXRankingTime) => {
      const cachePath = `cache/weapons-x-top-players.${moment(latestXRankingTime).format('YYYY-MM')}.json`;
      return { cachePath, cacheExists: fs.existsSync(cachePath) };
    })
    .then(({ cachePath, cacheExists }) => {
      if (cacheExists) { // cache hit
        res.json(JSON.parse(fs.readFileSync(cachePath)));
      } else {
        queryWeaponTopPlayers()
          .then((queryResult) => {
            if (queryResult.rows.length === 0) {
              return [];
            }
            return queryResult.rows.map((row) => {
              const topPlayers = {
                1: null, 2: null, 3: null, 4: null,
              };
              row.top_players.forEach((player) => {
                topPlayers[player[0]] = {
                  player_id: player[1],
                  name: player[2],
                  rating: Number(player[3]),
                  start_time: player[4],
                };
              });
              return {
                weapon_id: row.weapon_id,
                top_players: topPlayers,
              };
            });
          })
          .then((topPlayers) => {
            res.json(topPlayers);
            fs.writeFileSync(cachePath, JSON.stringify(topPlayers));
          });
      }
    });
});

app.get('/splatfests', (req, res) => {
  db
    .select('*')
    .from('splatfest_schedules')
    .where('start_time', '<', 'now()')
    .orderBy('start_time', 'desc')
    .then(rows => res.json(rows));
});

app.get('/stats', (req, res) => {
  db.raw(`
    select
        (select count(distinct(start_time)) from x_rankings) as x_rankings,
        (select reltuples::bigint from pg_class where relname='league_rankings') as league_rankings_estimate,
        (select count(*) from splatfest_schedules) as splatfests`)
    .then(queryResult => queryResult.rows[0])
    .then(result => res.json(result));
});

module.exports = app;
