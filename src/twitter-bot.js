const fs = require('fs');
const moment = require('moment-timezone');
const playwright = require('playwright-core');
const pug = require('pug');

const config = require('../config');
const { findRuleKey } = require('./data');
const { getLeagueSchedule } = require('./query');
const { getSplatnetApi } = require('./splatnet');
const { postMediaTweet } = require('./twitter-client');
const { dateToSqlTimestamp, i18nEn } = require('./util');

/**
 * @desc Take screenshots of given HTMLs.
 * @param {String[]} htmls
 * @param {String} cachePrefix
 * @returns {Promise<Buffer[]>} Screenshots
 */
const takeScreenshots = async (htmls, cachePrefix) => {
  const browser = await playwright.chromium.launch({
    args: ['--no-sandbox'],
    executablePath: config.CHROMIUM_PATH,
  });

  try {
    const context = await browser.newContext({
      viewport: { height: 640, width: 480 },
    });
    const screenshots = await Promise.all(htmls.map(async (html, i) => {
      const page = await context.newPage();
      await page.setContent(html);

      // Saves image and html to file for easier debugging.
      const filename = `${cachePrefix}-${i}`;
      fs.writeFileSync(`cache/tweets/${filename}.html`, html);
      const image = await page.screenshot({ path: `cache/tweets/${filename}.png` });
      await page.close();
      return image;
    }));

    return screenshots;
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    browser.close();
  }
};

/**
 * @desc Generate HTML from league result
 */
const generateLeagueResultHTML = async (leagueResult) => {
  const groupType = leagueResult.league_type.key;
  const playerNames = {};
  const playerIds = leagueResult.rankings.slice(0, 5).flatMap((team) => team.tag_members.map((member) => member.principal_id));
  const queryStrings = playerIds.map((id) => `id=${id}`).join('&');
  const namesRes = await getSplatnetApi(`nickname_and_icon?${queryStrings}`);
  namesRes.nickname_and_icons.forEach((player) => { playerNames[player.nsa_id] = player.nickname; });

  return pug.renderFile('./tweet-templates/league.pug', {
    imageBasePath: `http://localhost:${config.PORT}/static/images`,
    groupType,
    playerNames,
    rankings: leagueResult.rankings.slice(0, 5),
    splatoonStatsUrl: config.FRONTEND_ORIGIN.replace(/https?:\/\//, ''),
  });
};

/**
 * @desc Tweets league updates
 */
const tweetLeagueUpdates = async (leagueResults) => {
  const htmls = await Promise.all(leagueResults.map(generateLeagueResultHTML));
  let screenshots;

  try {
    screenshots = await takeScreenshots(htmls, 'league');
  } catch (e) {
    console.log(e);
    throw e;
  }

  const startDate = moment(leagueResults[0].start_time * 1000).utc();
  const endDate = moment(leagueResults[0].start_time * 1000).utc().add(2, 'h');
  const leagueId = leagueResults[0].league_id;

  const schedule = await getLeagueSchedule(dateToSqlTimestamp(leagueResults[0].start_time * 1000));
  const stageIds = schedule.stage_ids.slice().sort();
  const stageNames = stageIds.map((stageId) => `stages.${stageId}.name`).map(i18nEn);
  const ruleName = i18nEn(`rules.${findRuleKey(schedule.rule_id)}.name`);
  const text = `League Rankings for ${startDate.format('YYYY-MM-DD HH:mm')} ~ ${endDate.format('HH:mm')}
Rule: ${ruleName}
Stage: ${stageNames.join(' / ')}

See full ranking on ${config.FRONTEND_ORIGIN}/rankings/league/${leagueId}`;

  if (!config.ENABLE_SCHEDULED_TWEETS) return;

  // eslint-disable-next-line consistent-return
  return postMediaTweet(text, screenshots);
};

module.exports = {
  tweetLeagueUpdates,
};