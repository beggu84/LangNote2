var express = require('express');
var router = express.Router();

var applicationModify = require('./application_modify');
router.use('/:appl_id/modify', applicationModify);

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var urlParser = require('./util/url_parser');
var mailSender = require('./util/mail_sender');

router.post('/:appl_id/comment_delete', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.cmnt_id || req.body.cmnt_id.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM appl_comment WHERE id='+mysql.escape(req.body.cmnt_id);
    console.log(sql);
    
    conn.query(sql, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

router.post('/:appl_id/comment_news_broadcast', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.comment || req.body.comment.length == 0 ||
     !req.body.url || req.body.url.length == 0)  { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var user_id = urlParser.getUser(req.originalUrl);
    if(req.session.user_id != user_id) { // 1. 예문의 주인에게 (자신 제외)
      var sql = 'SELECT name, news_receive FROM user WHERE id='+mysql.escape(user_id);
      console.log(sql);
      
      // 1-1. check the owner is willing to receive news
      conn.query(sql, function(err, users) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(users.length != 1) { res.sendStatus(400); conn.release(); return; }
        
        if(users[0].news_receive == 1) {
          // 1-2. send mail
          var lang_code = urlParser.getLanguage(req.originalUrl);
          var pttn_id = urlParser.getPattern(req.originalUrl);
          var returnUrl = req.body.url + '/user/'+user_id + '/lang/'+lang_code + '/pttn/'+pttn_id + '/appl/'+req.params.appl_id;
          var subject = 'OLangnote - 댓글'
          var html = '';
          html += users[0].name+'님의 예문에 '+req.session.name+'님이 댓글을 달았습니다.';
          html += '<br/>';
          html += '<a href="'+returnUrl+'">'+req.session.name+': '+req.body.comment+'</a>';
          mailSender.transportHtml(subject, html);
        }
        
        broadcast();
      });
    } else {
      broadcast();
    }
  
    function broadcast() { // 2. 댓글을 단 제 3자들에게 (메일을 수신하기로한 유저들에 한함)
      sql = 'SELECT writer_id, name FROM user INNER JOIN (SELECT writer_id FROM appl_comment WHERE appl_id=?) AS sub_comment ON user.id=sub_comment.writer_id WHERE news_receive=1';
      var params = [ req.params.appl_id ];
      console.log(sql, params);

      // 2-1. find relatives
      conn.query(sql, params, function(err, cmntUsers) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(cmntUsers.length == 0) { res.sendStatus(200); conn.release(); return; }
        
        var users = [];
        for(var ci in cmntUsers) {
          // 자신과 예문 주인은 제외
          if(cmntUsers[ci].writer_id == req.session.user_id || cmntUsers[ci].writer_id == user_id)
            continue;
          
          // 이미 포함됬으면 제외
          var exist = false;
          for(var ri in users) {
            if(cmntUsers[ci].writer_id == users[ri].writer_id) {
              exist = true;
              break;
            } 
          }
          
          if(!exist)
            users.push(cmntUsers[ci]);
        }
        
        // 2-2. send mails
        users.forEach(function(user) {
          var returnUrl = req.body.url + '/user/'+user_id + '/lang/'+lang_code + '/pttn/'+pttn_id + '/appl/'+req.params.appl_id;
          var subject = 'OLangnote - 댓글'
          var html = '';
          html += user.name+'님이 작성한 댓글에 '+req.session.name+'님도 댓글을 달았습니다.';
          html += '<br/>';
          html += '<a href="'+returnUrl+'">'+req.session.name+': '+req.body.comment+'</a>';
          mailSender.transportHtml(subject, html);
        });
        
        res.sendStatus(200);
        
        conn.release();
      });
    }
  }); // getConnection
});

router.post('/:appl_id/comment_add', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.comment || req.body.comment.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'INSERT INTO appl_comment (appl_id, writer_id, text, reg_date) VALUES (?, ?, ?, now())';
    var params = [ req.params.appl_id, req.session.user_id, req.body.comment ];
    console.log(sql);
    
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.status(200).send({
        cmnt_id: result.insertId,
        writer_id: req.session.user_id,
        name: req.session.name
      });
      
      conn.release();
    });
  }); // getConnection
});

router.post('/:appl_id/delete', function(req, res) {
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id != user_id) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM application WHERE id=? AND user_id=?';
    var params = [ req.params.appl_id, req.session.user_id ];
    console.log(sql, params);
    
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

router.get('/:appl_id', function(req, res) {
  var user_id = urlParser.getUser(req.originalUrl);
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'appl');
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlUser = 'SELECT name FROM user WHERE id=' + mysql.escape(user_id) + '; ';
    var sqlAppl = 'SELECT * FROM application WHERE id=' + mysql.escape(req.params.appl_id) + '; ';
    var sqlCopy = 'SELECT src_id FROM appl_copy WHERE dest_id=' + mysql.escape(req.params.appl_id) + '; ';
    var sqlCmnt = 'SELECT appl_comment.id AS cmnt_id, writer_id, name, text FROM appl_comment INNER JOIN user ON appl_comment.writer_id=user.id WHERE appl_id='+mysql.escape(req.params.appl_id) + ' ORDER BY appl_comment.reg_date;'; 
    var sql = sqlUser + sqlAppl + sqlCopy + sqlCmnt;
    console.log(sql);
    
    // 1. get basic info (user name, application, src id)
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var users = rows[0];
      var appls = rows[1];
      if(users.length != 1 || appls.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
      
      var appl = appls[0];
      appl.comments = rows[3];
      var render = function() {
        res.render('application', {
          title: (appl.quiz == 1 ? appl.mean : appl.text),
          header: users[0].name,
          auth: (req.session.user_id == user_id),
          login: (req.session.user_id != null),
          appl: appl,
          id: req.session.user_id
        });
      }
      
      if(appl.quiz == 0) { render(); conn.release(); return; }
      
      var applCopies = rows[2];
      if(applCopies.length == 0) {
        appl.src_exist = false;
        conn.release();
        render();
        return;
      }
      appl.src_exist = true;
      appl.src_id = applCopies[0].src_id;
      
      sql = 'SELECT name, user_id, pttn_id FROM user INNER JOIN (SELECT id, user_id, pttn_id FROM application WHERE id='+mysql.escape(appl.src_id)+') AS appl ON user.id=appl.user_id';
      console.log(sql);
      
      // 2. get source user name and pattern id
      conn.query(sql, function(err, srcUserAppls) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(srcUserAppls.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
        
        appl.src_user_name = srcUserAppls[0].name;
        appl.src_user_id = srcUserAppls[0].user_id;
        appl.src_pttn_id = srcUserAppls[0].pttn_id;
        render();
        
        conn.release();
      });
    });
  }); // getConnection
});

router.get('/', function(req, res) {
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'appl');
  res.redirect(redirectUrl);
});

module.exports = router;
