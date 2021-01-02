const fs = require('fs');
const moment = require('moment-timezone');
const playwright = require('playwright-core');
const pug = require('pug');

const config = require('../config');
const { findRuleKey, rankedRuleIds } = require('./data');
const {
  getLeagueSchedule,
  queryWeaponRanking,
  queryWeaponUsageDifference,
  queryWeaponTopPlayersForMonth,
} = require('./query');
const { getSplatnetApi } = require('./splatnet');
const { postMediaTweet } = require('./twitter-client');
const { dateToSqlTimestamp, i18nEn } = require('./util');

/**
 * @desc Add sign to number
 * @param {Number} number
 * @returns {String} Number with sign (e.g. +1, 0, -2)
 */
const addSign = (number) => {
  if (number > 0) {
    return `+${number}`;
  }
  return number;
};

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
    const screenshots = await Promise.all(
      htmls.map(async (html, i) => {
        const page = await context.newPage();
        await page.setContent(html);

        // Saves image and html to file for easier debugging.
        const filename = `${cachePrefix}-${i}`;
        fs.writeFileSync(`cache/tweets/${filename}.html`, html);
        const image = await page.screenshot({ path: `cache/tweets/${filename}.png` });
        await page.close();
        return image;
      }),
    );

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
  const playerIds = leagueResult.rankings
    .slice(0, 5)
    .flatMap((team) => team.tag_members.map((member) => member.principal_id));
  const queryStrings = playerIds.map((id) => `id=${id}`).join('&');
  const namesRes = await getSplatnetApi(`nickname_and_icon?${queryStrings}`);
  namesRes.nickname_and_icons.forEach((player) => {
    playerNames[player.nsa_id] = player.nickname;
  });

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
  const endDate = moment(leagueResults[0].start_time * 1000)
    .utc()
    .add(2, 'h');
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

const generateXSummaryHTML = (data) => {
  return pug.renderFile('./tweet-templates/x.pug', {
    addSign,
    imageBasePath: `http://localhost:${config.PORT}/static/images`,
    splatoonStatsUrl: config.FRONTEND_ORIGIN,
    ...data,
  });
};

/**
 * @param {moment.Moment} currentMonth
 */
const tweetXUpdates = async (currentMonth) => {
  const month = moment(currentMonth).format('YYYY-MM');
  const previousMonth = moment(currentMonth).clone().subtract(1, 'month');
  const currentMonthTimestamp = currentMonth.format('YYYY-MM-DD');
  const previousMonthTimestamp = previousMonth.format('YYYY-MM-DD');

  const data = await Promise.all(
    rankedRuleIds.map(async (ruleId) => {
      const ruleName = i18nEn(`rules.${findRuleKey(ruleId)}`).name;
      const differences = await queryWeaponUsageDifference({
        rankingType: 'x',
        weaponType: 'weapons',
        currentMonth: currentMonthTimestamp,
        previousMonth: previousMonthTimestamp,
        ruleId,
        /* region, splatfestId, */
      });
      const weaponRanking = (
        await queryWeaponRanking({
          rankingType: 'x',
          ruleId,
          startTime: currentMonthTimestamp,
          weaponType: 'weapons',
        })
      ).slice(0, 10);
      const top10Weapons = weaponRanking.map((weapon) => weapon.weapon_id);
      const topPlayers = await queryWeaponTopPlayersForMonth(currentMonthTimestamp, ruleId, top10Weapons);

      return {
        title: `${month}   ${ruleName}`,
        topPlayers,
        weaponRanking,
        differences: Object.fromEntries(differences.map((w) => [w.weapon_id, w])),
      };
    }),
  );

  const htmls = await Promise.all(data.map(generateXSummaryHTML));
  const screenshots = await takeScreenshots(htmls, 'x');

  const text = `X Rankings for ${month}

See full ranking on ${config.FRONTEND_ORIGIN}/rankings/x/${month.replace('-', '/')}`;

  if (!config.ENABLE_SCHEDULED_TWEETS) return;

  return postMediaTweet(text, screenshots);
};

module.exports = {
  tweetLeagueUpdates,
  tweetXUpdates,
};
