var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var langJson = require('./util/lang_json');
var sqlHelper = require('./util/sql_helper');
var urlParser = require('./util/url_parser');
var bodyConverter = require('./util/body_converter');

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.cookie('urlBeforeLogin', req.originalUrl);
    res.redirect('/login');
    return;
  }
  
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'modify');
  
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id != user_id) { res.redirect(redirectUrl); return; }
  
  var appl_id = urlParser.getApplication(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT * FROM application WHERE id='+mysql.escape(appl_id) + 'AND user_id='+mysql.escape(req.session.user_id) + ' ORDER BY reg_date DESC; ';
    console.log(sql);
    
    conn.query(sql, function(err, appls) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(appls.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
      
      var appl = appls[0];
      res.render('application_modify', {
        title: (appl.quiz == 1 ? appl.mean : appl.text),
        header: '예문 수정',
        login: (req.session.user_id != null),
        appl: appl
      });
      
      conn.release();
    });
  }); // getConnection
});

router.post('/', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  if(!req.body.appl_text || req.body.appl_text.length == 0 ||
     !req.body.appl_mean || req.body.appl_mean.length == 0) { res.sendStatus(400); return; }
     
  var appl_id = urlParser.getApplication(req.originalUrl);
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'modify');
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'UPDATE application SET text=?, mean=? WHERE id=? AND user_id=?';
    var params = [ req.body.appl_text, req.body.appl_mean, appl_id, req.session.user_id ];
    console.log(sql, params);
      
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.redirect(redirectUrl);
      
      conn.release();
    });
  });
});

module.exports = router;
