const Twitter = require('twitter');
const config = require('../config');

const defaultClient = new Twitter({
  consumer_key: config.TWITTER_API_CONSUMER_KEY,
  consumer_secret: config.TWITTER_API_CONSUMER_SECRET,
  access_token_key: config.TWITTER_API_TOKEN_KEY,
  access_token_secret: config.TWITTER_API_TOKEN_SECRET,
});
const leagueClient = new Twitter({
  consumer_key: config.TWITTER_API_LEAGUE_CONSUMER_KEY,
  consumer_secret: config.TWITTER_API_LEAGUE_CONSUMER_SECRET,
  access_token_key: config.TWITTER_API_LEAGUE_TOKEN_KEY,
  access_token_secret: config.TWITTER_API_LEAGUE_TOKEN_SECRET,
});

/** @param {Twitter} client */
const createTwitterBot = (client = defaultClient) => {
  const postTweet = (text, params = {}) =>
    client.post('statuses/update', {
      ...params,
      status: text,
    });

  const postMediaTweet = async (text, media) => {
    const mediaIds = await Promise.all(
      media.map(async (medium) => {
        const res = await client.post('media/upload', { media: medium });
        return res.media_id_string;
      }),
    );

    return postTweet(text, { media_ids: mediaIds.join(',') });
  };

  return {
    postTweet,
    postMediaTweet,
  };
};

module.exports = {
  leagueClient,
  createTwitterBot,
};
