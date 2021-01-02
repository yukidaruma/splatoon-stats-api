const express = require('express');
const { wrapPromise } = require('./util');
const { getKnownNames, queryPlayerRankingRecords } = require('./query');

const router = express.Router();
router.get(
  '/players/:playerId([\\da-f]{16})',
  wrapPromise(async (req, res) => {
    const id = req.params.playerId;
    const [names, x, league, splatfest] = await Promise.all([
      getKnownNames(id),
      ...['x', 'league', 'splatfest'].map((rankingType) => queryPlayerRankingRecords(rankingType, id)),
    ]);

    return res.json({
      name: names?.[0]?.player_name ?? null,
      id,
      names,
      rankings: {
        x,
        league,
        splatfest,
      },
    });
  }),
);

module.exports = router;
