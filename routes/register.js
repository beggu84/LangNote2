var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var hashMaker = require('./util/hash_maker');

router.post('/id_dupl_check', function(req, res) {
  if(!req.body.id || req.body.id.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT COUNT(id) AS id_count FROM user WHERE id=' + mysql.escape(req.body.id);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      console.log(rows);
      if(rows[0].id_count == 0)
        res.status(200).send('success');
      else
        res.status(200).send('fail');
      
      conn.release();
    });
  }); // getConnection
});

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
  res.render('register', {
    title: '회원가입',
    header: '회원가입',
    login: (req.session.user_id != null)
  });
});

router.post('/', function(req, res) {
  if(!req.body.id || req.body.id.length == 0 ||
     !req.body.password || req.body.password.length == 0 ||
     !req.body.name || req.body.name.length == 0 ||
     !req.body.email || req.body.email.length == 0) {
     res.redirect(req.originalUrl);
     return;
  }
  
  var news_receive = (req.body.news_receive && req.body.news_receive == 'on') ? 1 : 0;
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var shaPassword = hashMaker.sha256(req.body.password);
    
    var sql = 'INSERT INTO user VALUES (?, ?, ?, ?, ?, now())';
    var params = [
      req.body.id,
      shaPassword,
      req.body.name,
      req.body.email,
      news_receive
    ];
    console.log(sql, params);
    
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(result.affectedRows != 1) { res.sendStatus(400); conn.release(); return; }
      
      req.session.user_id = req.body.id;
      req.session.name = req.body.name;
      
      res.redirect('/user/'+req.body.id);
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
