const cron = require('node-cron');
const moment = require('moment-timezone');
const app = require('./src/web-api');
const config = require('./config');
const { fetchStageRotations, fetchLeagueRanking, fetchXRanking } = require('./src/cron-job');
const { calculateLeagueDate } = require('./src/util');
const { NintendoAPIError } = require('./src/errors');

// Fetch League Ranking every 2 hours
cron.schedule('20 1-23/2 * * *', () => { // See https://crontab.guru/#20_1-23/2_*_*_*
  // The latest ranking available is the one from 2 hours ago.
  const leagueDate = calculateLeagueDate(new Date() - 120 * 60 * 1000);

  const fetchLeagueRankings = () => {
    const tasks = [`${leagueDate}T`, `${leagueDate}P`].map(leagueId => fetchLeagueRanking(leagueId));
    return Promise.all(tasks);
  };

  Promise.all([fetchStageRotations(), fetchLeagueRankings()])
    .then(() => console.log(`Successfully completed cron job at ${moment().format('YYYY-MM-DD HH:mm:ss')}.`))
    .catch((err) => {
      if (err instanceof NintendoAPIError) { // Expected errors
        console.log(err);
      } else {
        // Unexpected error?
        console.error(err);
      }
    });
}, null, true, 'Asia/Tokyo');

// Fetch X Ranking every month
cron.schedule('20 11 1 * *', () => { // See https://crontab.guru/#20_11_1_*_*
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth + 1;
  fetchXRanking(year, month)
    .then(() => {
      console.log(`Successfully fetched X Ranking for ${year}/${month}.`);
    })
    .catch((err) => {
      console.log(`Failed to fetch X Ranking for ${year}/${month}.`);
      console.error(err);
    });
}, null, true, 'Asia/Tokyo');

// Web interface
app.listen(config.PORT, () => {
  console.log(`Web server is listening on ${config.PORT}.`);
});
