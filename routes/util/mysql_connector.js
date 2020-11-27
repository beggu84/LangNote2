var pool = null;
exports.initPool = function() {
	var mysql = require('mysql');
	this.pool = mysql.createPool( {
		host: '192.168.219.100',
		//port: 3306,
		user: 'wooki',
		password: 'j445895',
		database: 'langnote2',
		connectionLimit: 10,
		multipleStatements: true
	});
	console.log('start pool');
}

exports.getPool = function() {
	return this.pool;
}

exports.endPool = function() {
	this.pool.end(function(err) {
		console.log('end pool');
	});
}