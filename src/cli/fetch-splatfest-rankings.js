const { fetchSplatfestRankingsJob } = require('../cron-job');
const { db } = require('../db');

fetchSplatfestRankingsJob()
  .then(() => console.log('Successfully fetched all missing Splatfest rankings.'))
  .finally(() => {
    db.destroy();
  });
