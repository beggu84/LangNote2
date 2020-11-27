exports.sha256 = function(text) {
	var crypto = require('crypto');
	var shasum = crypto.createHash('sha256');
  shasum.update(text);
  return shasum.digest('hex');
}