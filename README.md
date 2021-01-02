# splatoon-stats-api

## Overview

- This project provides API used by [splatoon-stats-web](https://github.com/yukidaruma/splatoon-stats-web).
- The app is available online at [https://splatoon-stats.yuki.games](https://splatoon-stats.yuki.games).
- Updates are available on Twitter [@SplatoonStats](https://twitter.com/SplatoonStats).

This program fetches

- League Ranking every 2 hours.
- Splatfest schedules every day. If there's unfetched splatfest rankings, fetch them too.
- X Ranking at every first day of the month.

## Install

```sh
git clone https://github.com/yukidaruma/splatoon-stats-api.git
cd splatoon-stats-api
npm install
docker-compose build
```

## Start

```sh
docker-compose up postgres -d

# Install pm2 if not installed.
npm install -g pm2
pm2 start npm --name splatoon-stats -- run start

# You can use these commands as soon as PM2 daemon has started
pm2 logs
pm2 stop spatoon-stats
```

You need to run following setup commands before first run.

```sh
cat << EOF > .env # Create .env file to override settings in config.js
IKSM_SESSION=<your iksm session>
EOF
npm run setup


# Optional steps:
# Note these 2 commands has long interval between fetching.
# It's recommended to use screen/tmux to run these tasks in background.

# Run if you want past league rankings. By default, it will fetch all league rankings since 2018-01-01.
npm run fetch-league-rankings

# Run if you want past x rankings. By default, it will fetch all x rankings since 2018-05.
npm run fetch-x-rankings
```

## Third-party APIs

This app is using following third-party APIs.

- [Spatoon2.ink API](https://github.com/misenhower/splatoon2.ink/wiki/Data-access-policy) by [@mattisenhower](https://twitter.com/mattisenhower) for images, locales and future stage rotations.
- [Spla2 API](https://spla2.yuu26.com/) by [@m_on_yu](https://twitter.com/m_on_yu) for past league battle stage rotations.
- [Stat.ink API](https://github.com/fetus-hina/stat.ink/tree/master/doc/api-2) by [@fetus_hina](https://twitter.com/fetus_hina) for weapon names.
