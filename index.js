const { CronJob } = require('cron');
const moment = require('moment-timezone');
const app = require('./src/web-api');
const config = require('./config');
const {
  fetchStageRotations,
  fetchLeagueRanking,
  fetchXRanking,
  fetchSplatfestSchedules,
  fetchSplatfestRanking,
} = require('./src/cron-job');
const { calculateLeagueDate, wait } = require('./src/util');
const { queryUnfetchedSplatfests } = require('./src/query');
const { NintendoAPIError } = require('./src/errors');

// Fetch League Ranking every 2 hours
// eslint-disable-next-line no-new
new CronJob('20 0-22/2 * * *', () => { // See https://crontab.guru/#20_0-22/2_*_*_*
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
}, null, true, 'UTC');

// Daily job
// eslint-disable-next-line no-new
new CronJob('23 0 * * *', async () => { // See https://crontab.guru/#23_0_*_*_*
  await fetchSplatfestSchedules();

  const unfetchedSplatfests = await queryUnfetchedSplatfests();

  if (unfetchedSplatfests.length) {
    console.log(`[Daily job] There are ${unfetchedSplatfests.length} unfetched Splatfest(s).`);

    // unfetchedSplatfests = unfetchedSplatfests.slice(0, 5); // Limit to 5
    /* eslint-disable no-await-in-loop, camelcase */
    // eslint-disable-next-line no-restricted-syntax
    for (const { region, splatfest_id } of unfetchedSplatfests) {
      console.log(`[Daily job] Fetching Splatfest ranking for ${region} ${splatfest_id}.`);
      await fetchSplatfestRanking(region, splatfest_id);
      console.log('[Daily job] Done.');
      await wait(60000);
    }
    /* eslint-enable no-await-in-loop */
  }

  console.log(`[Daily job] Successfully completed daily cron job on ${moment().format('YYYY-MM-DD')}.`);
}, null, 'UTC');

// Monthly job
// eslint-disable-next-line no-new
new CronJob('20 2 1 * *', () => { // See https://crontab.guru/#20_2_1_*_*
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
}, null, true, 'UTC');

// Web interface
app.listen(config.PORT, () => {
  console.log(`Web server is listening on ${config.PORT}.`);
});
