const cron = require('node-cron');
const moment = require('moment-timezone');
const app = require('./src/web-api');
const config = require('./config');
const { fetchStageRotations, fetchNewRanking } = require('./src/cron-job');
const { calculateLeagueDate } = require('./src/util');
const { NintendoAPIError } = require('./src/errors');

cron.schedule('20 1-23/2 * * *', () => { // See https://crontab.guru/#20_1-23/2_*_*_*
  const leagueDate = calculateLeagueDate(new Date() - 120 * 60 * 1000); // The latest ranking available is the one from 2 hours ago.

  // For now, this only fetches latest ranking.
  // TODO: Fetch rankings of last 24 hours (so we don't have missed rankings)
  const fetchNewRankings = () => {
    const tasks = [`${leagueDate}T`, `${leagueDate}P`].map(leagueId => fetchNewRanking(leagueId));
    return Promise.all(tasks);
  };

  Promise.all([fetchStageRotations, fetchNewRankings()])
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

// Web interface
app.listen(config.PORT, () => {
  console.log(`Web server is listening on ${config.PORT}.`);
});
