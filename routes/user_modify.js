var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var hashMaker = require('./util/hash_maker');

router.post('/name_dupl_check', function(req, res) {
  if(!req.body.name || req.body.name.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT COUNT(name) AS name_count FROM user WHERE name=' + mysql.escape(req.body.name);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      console.log(rows);
      if(rows[0].name_count == 0)
        res.status(200).send('success');
      else
        res.status(200).send('fail');
      
      conn.release();
    });
  }); // getConnection
});

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.redirect('/login');
    return;
  }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT * FROM user WHERE id=' + mysql.escape(req.session.user_id);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(rows.length != 1) { res.sendStatus('400'); conn.release(); return; }
      
      res.render('user_modify', {
        title: '내 정보 수정',
        header: '',
        login: true,
        user: rows[0]
      });
      
      conn.release();
    });
  }); // getConnection
});

router.post('/', function(req, res) {
  if(!req.session.user_id) { res.sendStatus('400'); return; }
  if(!req.body.password || req.body.password.length == 0 ||
     !req.body.name || req.body.name.length == 0 ||
     !req.body.email || req.body.email.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var shaPassword = hashMaker.sha256(req.body.password);
    var news_receive = (req.body.news_receive && req.body.news_receive == 'on') ? 1 : 0;
    
    var sql = '';
    var params = [];
    if(req.body.new_pw && req.body.new_pw.length > 0) {
      var shaNewPw = hashMaker.sha256(req.body.new_pw);
      sql = 'UPDATE user SET password=?, name=?, email=?, news_receive=? WHERE id=? AND password=?';
      params = [ shaNewPw, req.body.name, req.body.email, news_receive, req.session.user_id, shaPassword ];
    } else {
      sql = 'UPDATE user SET name=?, email=?, news_receive=? WHERE id=? AND password=?';
      params = [ req.body.name, req.body.email, news_receive, req.session.user_id, shaPassword ];
    }
    console.log(sql, params);
    
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(result.affectedRows == 1)
        res.status(200).send('success');
      else
        res.status(200).send('fail');
    });
    
    conn.release();
  }); // getConnection
});

module.exports = router;
