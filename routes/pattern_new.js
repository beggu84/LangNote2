var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var langJson = require('./util/lang_json');
var bodyConverter = require('./util/body_converter');

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.cookie('urlBeforeLogin', req.originalUrl);
    res.redirect('/login');
    return;
  }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT code FROM language WHERE user_id=' + mysql.escape(req.session.user_id);
    console.log(sql);
    
    conn.query(sql, function(err, langs) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(langs.length == 0) { res.redirect('/user/'+req.session.user_id); conn.release(); return; }
      
      for(var i in langs)
        langs[i].name = langJson.getName(langs[i].code);
      var lang_code = null;
      if(req.cookies.recent_language && req.cookies.recent_language.length > 0)
        lang_code = req.cookies.recent_language;
      else
        lang_code = langs[0].code;
        
      res.render('pattern_input/new', {
        title: '새 패턴',
        header: '새 패턴',
        login: (req.session.user_id != null),
        langs: langs,
        sel_lang_code: lang_code
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
  
  res.cookie('recent_language', req.body.language);
  
  var pttnListUrl = '/user/'+req.session.user_id + '/lang/'+req.body.language + '/pttn';
  var redirectUrl = null;
  if(req.cookies.okay_and_see == 1) {
    redirectUrl = pttnListUrl;
    res.cookie('okay_and_see', 0);
  } else if(req.cookies.okay_and_cont == 1) {
    redirectUrl = req.originalUrl;
    res.cookie('okay_and_cont', 0);
  } else {
    if(req.cookies.urlBeforeAddPattern && req.cookies.urlBeforeAddPattern.length > 0)
      redirectUrl = req.cookies.urlBeforeAddPattern;
    else
      redirectUrl = pttnListUrl;
  }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'INSERT INTO pattern (user_id, lang_code, text, mean, reg_date) VALUES (?, ?, ?, ?, now())';
    var params = [ req.session.user_id, req.body.language, req.body.pttn_text, req.body.pttn_mean ];
    console.log(sql);
    
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      sql = 'INSERT INTO application (user_id, pttn_id, text, mean, reg_date) VALUES';
      var newAppls = bodyConverter.convertApplications(req.body);
      var newApplExist = false;
      for(var i in newAppls) {
        if(newAppls[i].text.length > 0) {
          if(newApplExist)
            sql += ',';
          else
            newApplExist = true;
          sql += ' ('
          + mysql.escape(req.session.user_id) + ', '
          + mysql.escape(result.insertId) + ', '
          + mysql.escape(newAppls[i].text) + ', '
          + mysql.escape(newAppls[i].mean) + ', now())';
        }
      }
      // pattern exist, but no application exist - normal case.
      if(!newApplExist) { res.redirect(redirectUrl); conn.release(); return; }
      console.log(sql);
      
      conn.query(sql, function(err, result) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        res.redirect(redirectUrl);
        
        conn.release();
      });
    });
  }); // getConnection
});

module.exports = router;
