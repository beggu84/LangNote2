function getCleanUrl() {
	var url = document.URL;
	/* for get param
	var paramPos = url.lastIndexOf('?');
	if(paramPos > 0)
		url = url.slice(0, paramPos);
	*/
	if(url[url.length-1] == '#')
	  url = url.slice(0, url.length-1);
	if(url[url.length-1] == '/')
	  url = url.slice(0, url.length-1);
	return url;
}

function getCleanPath() {
	var path = location.pathname;
	if(path[path.length-1] == '#')
	  path = path.slice(0, path.length-1);
	if(path[path.length-1] == '/')
	  path = path.slice(0, path.length-1);
	return path;
}

function cutBack(keyword) {
	var url = document.URL;
	var pos = url.lastIndexOf(keyword);
	if(pos < 0)
		return url;
	else
		return url.slice(0, pos-1);
}

function getUser() {
	return getParam('user');
}

function getLanguage() {
	return getParam('lang');
}

function getPattern() {
	return getParam('pttn');
}

function getParam(keyword) {
	var url = getCleanUrl();
	var initPos = url.indexOf(keyword);
	var varSttPos = url.indexOf('/', initPos) + 1;
	var varEndPos = url.indexOf('/', varSttPos+1);
	return url.slice(varSttPos, varEndPos);
}