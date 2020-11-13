/* eslint-disable */

module.exports = {
  "extends": "airbnb-base",
  "rules": {
    "arrow-body-style": "off",
    "max-len": ['warn', 120, 2, {
      ignoreUrls: true,
      ignoreComments: false,
      ignoreRegExpLiterals: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
    }],
  },
};
