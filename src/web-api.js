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

module.exports = app;
