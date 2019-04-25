const ExtensibleCustomError = require('extensible-custom-error');

class NintendoAPIError extends ExtensibleCustomError {}

module.exports = { NintendoAPIError };
