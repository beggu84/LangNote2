exports.getUser = function(url) {
	return getValue(url, 'user');
}

exports.getLanguage = function(url) {
	return getValue(url, 'lang');
};

exports.getPattern = function(url) {
	return getValue(url, 'pttn');
};

exports.getApplication = function(url) {
	return getValue(url, 'appl');
};

function getValue(url, keyword) {
	var initPos = url.indexOf(keyword);
	var varSttPos = url.indexOf('/', initPos) + 1;
	var varEndPos = url.indexOf('/', varSttPos+1);
	return url.slice(varSttPos, varEndPos);
}

exports.cutBack = function(url, keyword) {
	var pos = url.lastIndexOf(keyword);
	if(pos < 0)
		return url;
	else
		return url.slice(0, pos-1);
}