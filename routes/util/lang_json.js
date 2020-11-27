exports.getName = function(code) {
  var langs = this.getJson();
	for(var i in langs) {
		if(langs[i].code == code)
		  return langs[i].name;
	}
	return "";
}

exports.exist = function(code) {
	var langs = this.getJson();
	for(var i in langs) {
		if(langs[i].code == code)
		  return true;
	}
	return false;
}

exports.getJson = function() {
	return [
		{
			"code": "en",
			"name": "영어"
		},
		{
			"code": "zh",
			"name": "중국어"
		},
		{
			"code": "ja",
			"name": "일본어"
		},
		{
			"code": "fr",
			"name": "불어"
		},
		{
			"code": "es",
			"name": "스페인어"
		},
		{
			"code": "de",
			"name": "독일어"
		},
		{
			"code": "it",
			"name": "이탈리아어"
		}
	];
}
