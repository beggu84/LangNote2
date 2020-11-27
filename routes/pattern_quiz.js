var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var urlParser = require('./util/url_parser');

router.post('/okay', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  var pttn_id = urlParser.getPattern(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    
    conn.beginTransaction(function(err) {
      var sql = 'INSERT INTO application (user_id, pttn_id, text, mean, quiz, reg_date) VALUES (?, ?, ?, ?, 1, now())';
      var params = [ req.session.user_id, pttn_id, req.body.answer, req.body.quiz ];
      console.log(sql, params);
      
      conn.query(sql, params, function(err, result) {
         if(err) {
          return conn.rollback(function() {
            console.error(err);
            conn.destroy();
            throw err;
          });
        }
        
        sql = 'INSERT INTO appl_copy VALUES (?, ?, ?)';
        params = [ req.body.src_id, result.insertId, req.session.user_id ];
        console.log(sql, params);
        
        conn.query(sql, params, function(err, result) {
          if(err) {
            return conn.rollback(function() {
              console.error(err);
              conn.destroy();
              throw err;
            });
          }
          
          conn.commit(function(err) {
            if(err) {
              return conn.rollback(function() {
                console.error(err);
                conn.destroy();
                throw err;
              });
            }
            res.sendStatus(200);
            
            conn.release();
          }); // commit
        });
      });
    }); // beginTransaction
  }); // getConnection
});

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.cookie('urlBeforeLogin', req.originalUrl);
    res.redirect('/login');
    return;
  }
  
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'quiz');
  
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id != user_id) { res.redirect(redirectUrl); return; }
  
  var pttn_id = urlParser.getPattern(req.originalUrl);
 
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlPttn = 'SELECT text, mean FROM pattern WHERE id='+mysql.escape(pttn_id) + ' AND user_id='+mysql.escape(req.session.user_id) + '; ';
    var sqlCopy = 'SELECT src_id FROM pttn_copy WHERE dest_id=' + mysql.escape(pttn_id);
    var sql = sqlPttn + sqlCopy;
    console.log(sql);
    
    // 1. get source id
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var pttns = rows[0];
      if(pttns.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
      
      var copies = rows[1];
      var src_id = '';
      if(copies.length == 0) {
        src_id = pttn_id;
      } else if(copies.length == 1) {
        src_id = copies[0].src_id;
      }
       
      sql = 'SELECT * FROM application WHERE \
(pttn_id IN (SELECT dest_id AS pttn_id FROM pttn_copy WHERE src_id=?) OR \
pttn_id IN (SELECT src_id AS pttn_id FROM pttn_copy WHERE src_id=?)) AND \
id NOT IN (SELECT id FROM application WHERE pttn_id=? AND user_id=?) AND \
id NOT IN (SELECT src_id AS id FROM appl_copy WHERE copier_id=?) AND \
id NOT IN (SELECT dest_id AS id FROM appl_copy)';
      var params = [ src_id, src_id, pttn_id, req.session.user_id, req.session.user_id ];
      console.log(sql);
      
      // 2. get quiz - (복사되거나 복사한 패턴에 속해야함) and 내가 가진 예문은 아니어야 함 and 나에 의해서 이미 복사된 예문이 아니어야 함 and 복사본이 아니어야 함(최초 예문이 아니어야 함).
      conn.query(sql, params, function(err, rows) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        res.render('pattern_quiz', {
          title: pttns.text,
          header: '퀴즈',
          login: (req.session.user_id != null),
          pttn: pttns[0],
          appls: rows
        });
        
        conn.release();
      });
    });
  }); // getConnection
});

module.exports = router;
