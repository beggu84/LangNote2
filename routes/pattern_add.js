var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var urlParser = require('./util/url_parser');
var bodyConverter = require('./util/body_converter');
var mailSender = require('./util/mail_sender');

router.post('/quiz_news_broadcast', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.url || req.body.url.length == 0)  { res.sendStatus(400); return; }
  
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id != user_id) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var pttn_id = urlParser.getPattern(req.originalUrl);
    var sql = 'SELECT src_id FROM pttn_copy WHERE dest_id=' + mysql.escape(pttn_id);
    console.log(sql);
    
    // 1. get source id
    conn.query(sql, function(err, copies) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var src_id = '';
      if(copies.length == 0) {
        src_id = pttn_id;
      } else if(copies.length == 1) {
        src_id = copies[0].src_id;
      }
      
      sql = 'SELECT user.id AS user_id, name, pttn_id FROM user INNER JOIN (SELECT user_id, id AS pttn_id FROM pattern WHERE id IN (SELECT src_id AS id FROM pttn_copy WHERE src_id=?) OR id IN (SELECT dest_id AS id FROM pttn_copy WHERE src_id=?)) AS sub_pattern ON user.id=sub_pattern.user_id WHERE news_receive=1';
      var params = [ src_id, src_id ];
      console.log(sql, params);
      
      // 2. get linked users id (only users willing to receive news)
      conn.query(sql, params, function(err, rows) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        
        // 3. send mail
        rows.forEach(function(row) {
          if(row.user_id != user_id) {
            var lang_code = urlParser.getLanguage(req.originalUrl);
            var returnUrl = req.body.url + '/user/'+row.user_id + '/lang/'+lang_code + '/pttn/'+row.pttn_id + '/quiz';
            var subject = 'OLangnote - 퀴즈'
            var html = '';
            html += row.name+'님의 패턴에 퀴즈가 추가되었습니다.';
            html += '<br/>';
            html += '<a href="'+returnUrl+'">'+returnUrl+'</a>';
            mailSender.transportHtml(subject, html);
          }
        });
    
        res.sendStatus(200);
        
        conn.release();
      });
    });
  }); // getConnection
});

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.cookie('urlBeforeLogin', req.originalUrl);
    res.redirect('/login');
    return;
  }
  
  var pttn_id = urlParser.getPattern(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT text, mean FROM pattern WHERE id='+mysql.escape(pttn_id) + ' AND user_id='+mysql.escape(req.session.user_id);
    console.log(sql);
    
    conn.query(sql, function(err, pttns) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(pttns.length != 1) { res.sendStatus(400); conn.release(); return; }
      
      var pttn = pttns[0];
      res.render('pattern_input/add', {
        title: pttn.text,
        header: '예문 추가',
        pttn: pttn,
        login: (req.session.user_id != null),
      });
      
      conn.release();
    });
  }); // getConnection
});

router.post('/', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  var user_id = urlParser.getUser(req.originalUrl);
  var pttn_id = urlParser.getPattern(req.originalUrl);
  if(req.session.user_id != user_id) { res.sendStatus(400); return; }
  
  var newAppls = bodyConverter.convertApplications(req.body);
  if(!req.body.appl_text || newAppls.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'INSERT INTO application (user_id, pttn_id, text, mean, reg_date) VALUES';
    var applCount = 0;
    for(var i in newAppls) {
      if(newAppls[i].text.length == 0)
        continue;
      if(applCount > 0)
        sql += ',';
      sql += ' ('
      + mysql.escape(req.session.user_id) + ', '
      + mysql.escape(pttn_id) + ', '
      + mysql.escape(newAppls[i].text) + ', '
      + mysql.escape(newAppls[i].mean) + ', now())';
      applCount++;
    }
    
    if(applCount == 0) { res.sendStatus(400); conn.release(); return; }
    console.log(sql);
  
    conn.query(sql, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
