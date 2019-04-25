const express = require('express');

const { db } = require('./db');
const { calculateStartTimeFromLeagueDate } = require('./util');

const app = express();

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

app.get('/league/:type((weapons|specials|subs))/:month([1-9]|1[012])', (req, res) => {
  const { type, month } = req.params;

  if (type === 'weapons') {
    db.raw(`
select
  rank() over (order by popular_weapons.count desc),
  count,
  popular_weapons.weapon_id,
  sub_weapon_id,
  special_weapon_id,
  100 * count / sum(count) over () as percentage
from (
  select league_rankings.weapon_id, count(league_rankings.weapon_id) from league_rankings
    where extract(month from start_time) = ?
      group by league_rankings.weapon_id
      order by count desc, league_rankings.weapon_id desc
) as popular_weapons
  inner join weapons on popular_weapons.weapon_id = weapons.weapon_id
      `, [month])
      .then((result) => {
        res.json(result.rows);
      });
  } else if (type === 'specials' || type === 'subs') {
    // e.g.) specials -> special_weapon_id
    const columnName = `${type.substring(0, type.length - 1)}_weapon_id`;
    db.raw(`
select
  rank() over (order by popular_weapons.count desc),
  ${columnName},
  count,
  100 * count / sum(count) over () as percentage
from (
  select count(weapons.${columnName}), weapons.${columnName} from league_rankings
    inner join weapons on league_rankings.weapon_id = weapons.weapon_id
    where extract(month from start_time) = ?
    group by weapons.${columnName}
      order by count desc, weapons.${columnName} desc
) as popular_weapons
      `, [month])
      .then((result) => {
        res.json(result.rows);
      });
  } else { // Theoretically this block is unreachable.
    res.status(422).send('Bad type');
  }
});

module.exports = app;
