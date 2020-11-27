var express = require('express');
var router = express.Router();

var language = require('./language'); 
router.use('/:user_id/lang', language);

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var langJson = require('./util/lang_json');
var sqlHelper = require('./util/sql_helper');
var bodyConverter = require('./util/body_converter');

router.post('/:user_id/lang_delete', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  var langs_code = bodyConverter.convertLanguagesCode(req.body.langs_code);
  if(langs_code.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM language WHERE user_id='+mysql.escape(req.session.user_id) + ' AND (';
    langs_code.forEach(function(item, index) {
      if(item.length == 0) { res.sendStatus(400); conn.release(); return; }
      if(index > 0)
        sql += ' OR ';
      sql += 'code=' + mysql.escape(item);
    });
    sql += '); ';
    console.log(sql);
    
    conn.query(sql, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

router.get('/:user_id', function(req, res) {
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlUser = 'SELECT name FROM user WHERE id=' + mysql.escape(req.params.user_id) + '; ';
    var sqlLangs = 'SELECT code FROM language WHERE user_id=' + mysql.escape(req.params.user_id) + '; ';
    var sqlPttns = 'SELECT lang_code, COUNT(A.id) AS appl_count FROM ' + sqlHelper.subSelectPttnWhereUserId(req.params.user_id) + ' AS P LEFT JOIN ' + sqlHelper.subSelectApplWhereUserId(req.params.user_id) +' AS A ON P.id=A.pttn_id GROUP BY P.id;';
    var sql = sqlUser + sqlLangs + sqlPttns
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var users = rows[0];
      if(users.length != 1) { res.sendStatus('400'); conn.release(); return; }
      
      var myLangs = rows[1];
      var allLangs = langJson.getJson();
      for(var ai in allLangs) {
        var alang = allLangs[ai];
        alang.registered = false;
        for(var mi in myLangs) {
          if(alang.code == myLangs[mi].code) {
            alang.registered = true;
            break;
          }
        }
        
        var pttns = rows[2];
        if(alang.registered) {
          alang.ripe_pttn_count = 0;
          alang.unripe_pttn_count = 0;
          for(var ri in pttns) {
            if(alang.code == pttns[ri].lang_code) {
              if(pttns[ri].appl_count >= 5)
                alang.ripe_pttn_count++;
              else
                alang.unripe_pttn_count++;
            }
          }
        }
      }
      
      res.render('language_list', {
        title: users[0].name,
        header: users[0].name,
        auth: (req.session.user_id == req.params.user_id),
        login: (req.session.user_id != null),
        langs: allLangs
      });
      
      conn.release();
    });
  }); // getConnection
});

// add a language
router.post('/:user_id', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.language || req.body.language.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'INSERT INTO language (code, user_id, reg_date) VALUES (?, ?, now())';
    var params = [ req.body.language, req.session.user_id ];
    console.log(sql);
    
    conn.query(sql, params, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.redirect(req.originalUrl);
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
