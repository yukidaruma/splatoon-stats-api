const { CronJob } = require('cron');
const moment = require('moment-timezone');
const app = require('./src/web-api');
const config = require('./config');
const {
  fetchStageRotations,
  fetchLeagueRanking,
  fetchXRanking,
  fetchSplatfestRankingsJob,
} = require('./src/cron-job');
const { tweetLeagueUpdates, tweetXUpdates } = require('./src/twitter-bot');
const { calculateLeagueDate } = require('./src/util');
const { NintendoAPIError } = require('./src/errors');
const { hasXRankingForMonth } = require('./src/query');

// Fetch League Rankings every 2 hours
const fetchLeagueRankingsJob = () => {
  // The latest ranking available is the one from 2 hours ago.
  const leagueDate = calculateLeagueDate(new Date() - 120 * 60 * 1000);

  const fetchLeagueRankings = () => {
    const tasks = [`${leagueDate}T`, `${leagueDate}P`].map((leagueId) => fetchLeagueRanking(leagueId));
    return Promise.all(tasks);
  };

  return Promise.all([fetchStageRotations(), fetchLeagueRankings().then(tweetLeagueUpdates)])
    .then(() => console.log(`Successfully completed cron job at ${moment().format('YYYY-MM-DD HH:mm:ss')}.`))
    .catch((err) => {
      if (err instanceof NintendoAPIError) { // Expected errors
        console.log(err);
      } else {
        // Unexpected error?
        console.error(err);
      }
    });
};

// eslint-disable-next-line no-new
new CronJob('20 0-22/2 * * *', fetchLeagueRankingsJob, null, true, 'UTC'); // See https://crontab.guru/#20_0-22/2_*_*_*

// Daily job
// eslint-disable-next-line no-new
new CronJob('23 0 * * *', async () => { // See https://crontab.guru/#23_0_*_*_*
  if (config.DO_NOT_FETCH_SPLATFEST) {
    return;
  }

  console.log('[Daily job] Running fetchSplatfestRankingsJob.');
  await fetchSplatfestRankingsJob();
  console.log(`[Daily job] Successfully completed daily cron job on ${moment().format('YYYY-MM-DD')}.`);
}, null, true, 'UTC');

// Monthly job
const fetchXRankingsJob = async () => {
  const lastMonth = moment().utc().subtract(1, 'month').startOf('month');
  const year = lastMonth.year();
  const month = lastMonth.month() + 1;

  const hasFetched = await hasXRankingForMonth(year, month);
  if (hasFetched) {
    return;
  }

  console.log(`Fetching X Ranking for ${year}/${month}.`);

  try {
    await fetchXRanking(year, month);
    console.log(`Successfully fetched X Ranking for ${year}/${month}.`);

    await tweetXUpdates(lastMonth);
  } catch (e) {
    console.log(`Failed to fetch X Ranking for ${year}/${month}.`);
    console.error(e);
  }
};

// X Ranking is updated indeterminately (because of National holiday(s) in Japan)
// See https://crontab.guru/#20_0-22%2F2_*_*_*
// eslint-disable-next-line no-new
new CronJob('20 0-22/2 * * *', fetchXRankingsJob, null, true, 'UTC');

// Web interface
app.listen(config.PORT, () => {
  console.log(`Web server is listening on ${config.PORT} (NODE_ENV=${process.env.NODE_ENV}).`);
});
