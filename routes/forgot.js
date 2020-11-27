var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var hashMaker = require('./util/hash_maker');
var mailSender = require('./util/mail_sender');

router.get('/pw/:user_id/:hash', function(req, res) {
  if(!req.params.user_id || req.params.user_id.length == 0 ||
     !req.params.hash || req.params.hash.length == 0) { res.sendStatus(404); return; }

  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT password, name FROM user WHERE id='+mysql.escape(req.params.user_id);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(rows.length != 1) { res.sendStatus(400); conn.release(); return; }
      
      var idPlusPw = req.params.user_id + rows[0].password.slice(0,9);
      var hash = hashMaker.sha256(idPlusPw);
      if(hash != req.params.hash) { res.sendStatus(400); conn.release(); return; }
      
      req.session.user_id = req.params.user_id;
      req.session.name = rows[0].name;
      
      res.render('forgot_pw_change', {
        title: '비밀번호 변경',
        header: '',
        login: (req.session.user_id != null),
        id: req.params.user_id
      });
      
      conn.release();
    });
  }); // getConnection
});

router.post('/pw/:user_id/:hash', function(req, res) {
  if(!req.body.password || req.body.password.length == 0 ||
     !req.body.confirm || req.body.confirm.length == 0) { res.sendStatus(400); return; }
     
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT id, password FROM user WHERE id='+mysql.escape(req.params.user_id);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(rows.length != 1) { res.sendStatus(400); conn.release(); return; }
      
      var idPlusPw = req.params.user_id + rows[0].password.slice(0,9);
      var hash = hashMaker.sha256(idPlusPw);
      if(hash != req.params.hash) { res.sendStatus(400); conn.release(); return; }
    
      var shaPassword = hashMaker.sha256(req.body.password);
      var sql = 'UPDATE user SET password='+mysql.escape(shaPassword) + ' WHERE id='+mysql.escape(req.params.user_id);
      console.log(sql);
      
      conn.query(sql, function(err, result) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(result.affectedRows != 1) { res.sendStatus(400); conn.release(); return; }
        
        res.redirect('/user/'+req.params.user_id);
        
        conn.release();
      });
    });
  }); // getConnection
});

router.get('/', function(req, res) {
  res.render('forgot', {
    title: '아이디/비밀번호 찾기',
    header: '',
    login: (req.session.user_id != null)
  });
});

router.post('/id', function(req, res) {
  if(!req.body.email || req.body.email.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT id FROM user WHERE email='+mysql.escape(req.body.email);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(rows.length == 1) {
        res.status(200).send({
          result: 'success',
          id: rows[0].id
        });
      } else {
        res.status(200).send({
          result: 'fail'
        });
      }
      
      conn.release();
    });
  }); // getConnection
});

router.post('/pw', function(req, res) {
  if(!req.body.id || req.body.id.length == 0 ||
     !req.body.url || req.body.url.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT password FROM user WHERE id='+mysql.escape(req.body.id);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(rows.length == 0) {
        res.status(200).send('fail');
        conn.release();
        return;
      }
      
      var idPlusPw = req.body.id + rows[0].password.slice(0,9);
      var hash = hashMaker.sha256(idPlusPw);
      var returnUrl = req.body.url+'/forgot/pw/'+req.body.id+'/'+hash;
      
      var subject = 'OLangNote - 비밀번호 찾기';
      var html = '';
      html += '아이디: ' + req.body.id;
      html += '<br/><br/>';
      html += '아래 주소를 따라가서 비밀번호를 변경하세요.';
      html += '<br/>';
      html += '<a href="'+returnUrl+'">'+returnUrl+'</a>';
      mailSender.transportHtml(subject, html);
        
      res.status(200).send('success');
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;