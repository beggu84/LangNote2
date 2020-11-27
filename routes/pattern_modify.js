var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var langJson = require('./util/lang_json');
var sqlHelper = require('./util/sql_helper');
var urlParser = require('./util/url_parser');
var bodyConverter = require('./util/body_converter');
 
router.post('/appl_delete', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.appl_id || req.body.appl_id.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM application WHERE id='+mysql.escape(req.body.appl_id) + ' AND user_id='+mysql.escape(req.session.user_id);
    console.log(sql);
    
    conn.query(sql, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  });
});

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.cookie('urlBeforeLogin', req.originalUrl);
    res.redirect('/login');
    return;
  }
  
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'modify');
  
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id != user_id) { res.redirect(redirectUrl); return; }
  
  var pttn_id = urlParser.getPattern(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlLangs = 'SELECT code FROM language WHERE user_id='+mysql.escape(req.session.user_id) + '; ';
    var sqlPttnAndAppls = sqlHelper.selectPttnAndApplsAuth(pttn_id, req.session.user_id);
    var sqlCopy = 'SELECT COUNT(*) AS copy_count FROM pttn_copy WHERE src_id='+mysql.escape(pttn_id) + ' OR dest_id='+mysql.escape(pttn_id);
    var sql = sqlLangs + sqlPttnAndAppls + sqlCopy;
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var pttns = rows[1];
      if(pttns.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
      
      var langs = rows[0];
      for(var i in langs)
        langs[i].name = langJson.getName(langs[i].code);
      
      var pttn = pttns[0];
      res.render('pattern_input/modify', {
        title: pttn.text,
        header: '패턴 수정',
        login: (req.session.user_id != null),
        langs: langs,
        sel_lang_code: pttn.lang_code,
        pttn: pttn,
        appls: rows[2],
        copy: (rows[3][0].copy_count > 0)
      });
      
      conn.release();
    });
  }); // getConnection
});

router.post('/', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  if(!req.body.language || req.body.language.length == 0 ||
     !req.body.pttn_text || req.body.pttn_text.length == 0 ||
     !req.body.pttn_mean || req.body.pttn_mean.length == 0) { res.sendStatus(400); return; }
     
  var pttn_id = urlParser.getPattern(req.originalUrl);
  var newAppls = bodyConverter.convertApplications2(req.body);
  
  if(urlParser.getLanguage(req.originalUrl) != req.body.language)
    res.cookie('recent_language', req.body.language);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlPttn = 'UPDATE pattern SET'
      + ' lang_code=' + mysql.escape(req.body.language)
      + ', text=' + mysql.escape(req.body.pttn_text)
      + ', mean=' + mysql.escape(req.body.pttn_mean)
      + ' WHERE id='+mysql.escape(pttn_id) + ' AND user_id='+mysql.escape(req.session.user_id) + '; ';
    var sqlAppls = "";
    newAppls.forEach(function(item, index) {
      sqlAppls += 'UPDATE application SET text=' + mysql.escape(newAppls[index].text)
      + ', mean=' + mysql.escape(newAppls[index].mean)
      + ' WHERE id='+mysql.escape(newAppls[index].id) + ' AND user_id='+mysql.escape(req.session.user_id) + '; ';
    });
    var sql = sqlPttn + sqlAppls;
    console.log(sql);
      
    conn.query(sql, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
