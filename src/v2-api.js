const express = require('express');
const { wrapPromise } = require('./util');

const router = express.Router();
router.get(
  '/players/:playerId([\\da-f]{16})',
  wrapPromise(async (req, res) => {
    res.json({ id: req.params.playerId });
  }),
);

module.exports = router;
