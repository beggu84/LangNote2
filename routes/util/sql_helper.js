var mysql = require('mysql');

exports.selectPttnAndAppls = function(pttn_id) {
	var sqlPttn = 'SELECT * FROM pattern WHERE id='+mysql.escape(pttn_id) + '; ';
	var sqlAppls = 'SELECT * FROM application WHERE pttn_id='+mysql.escape(pttn_id) + ' ORDER BY reg_date DESC; ';
	return sqlPttn + sqlAppls;
}

exports.selectPttnAndApplsAuth = function(pttn_id, user_id) {
	var sqlPttn = 'SELECT * FROM pattern WHERE id='+mysql.escape(pttn_id) + 'AND user_id='+mysql.escape(user_id) + '; ';
	var sqlAppls = 'SELECT * FROM application WHERE pttn_id='+mysql.escape(pttn_id) + 'AND user_id='+mysql.escape(user_id) + ' ORDER BY reg_date DESC; ';
	return sqlPttn + sqlAppls;
}

exports.subSelectPttnWhereUserId = function(user_id) {
	return '(SELECT * FROM pattern WHERE user_id='+ mysql.escape(user_id) + ')';
}

exports.subSelectPttnWhereUserIdAndLangCode = function(user_id, lang_code) {
	return '(SELECT * FROM pattern WHERE user_id='+ mysql.escape(user_id) + ' AND lang_code='+mysql.escape(lang_code) + ')';
}

exports.subSelectApplWhereUserId = function(user_id) {
	return '(SELECT * FROM application WHERE user_id='+ mysql.escape(user_id) + ')';
}