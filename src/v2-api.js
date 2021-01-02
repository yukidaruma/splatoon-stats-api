const express = require('express');
const { wrapPromise } = require('./util');
const { getKnownNames } = require('./query');

const router = express.Router();
router.get(
  '/players/:playerId([\\da-f]{16})',
  wrapPromise(async (req, res) => {
    const id = req.params.playerId;
    const [names] = await Promise.all([getKnownNames(id)]);

    return res.json({
      name: names?.[0]?.player_name ?? null,
      id,
      names,
    });
  }),
);

module.exports = router;
