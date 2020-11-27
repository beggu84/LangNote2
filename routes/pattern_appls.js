var express = require('express');
var router = express.Router();

var application = require('./application'); 
router.use('/:pttn_id/appl', application);

var patternCopy = require('./pattern_copy');
var patternQuiz = require('./pattern_quiz');
var patternAdd = require('./pattern_add');
var patternModify = require('./pattern_modify');
router.use('/:pttn_id/copy', patternCopy);
router.use('/:pttn_id/quiz', patternQuiz);
router.use('/:pttn_id/add', patternAdd);
router.use('/:pttn_id/modify', patternModify);

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var sqlHelper = require('./util/sql_helper');
var urlParser = require('./util/url_parser');
var bodyConverter = require('./util/body_converter');
var mailSender = require('./util/mail_sender');

router.post('/:pttn_id/comment_delete', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.cmnt_id || req.body.cmnt_id.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM pttn_comment WHERE id='+mysql.escape(req.body.cmnt_id);
    console.log(sql);
    
    conn.query(sql, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

router.post('/:pttn_id/comment_news_broadcast', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.comment || req.body.comment.length == 0 ||
     !req.body.url || req.body.url.length == 0)  { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var user_id = urlParser.getUser(req.originalUrl);
    if(req.session.user_id != user_id) { // 1. 패턴의 주인에게 (자신 제외)
      var sql = 'SELECT name, news_receive FROM user WHERE id='+mysql.escape(user_id);
      console.log(sql);
      
      // 1-1. check the owner is willing to receive news
      conn.query(sql, function(err, users) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(users.length != 1) { res.sendStatus(400); conn.release(); return; }
        
        if(users[0].news_receive == 1) {
          // 1-2. send mail
          var lang_code = urlParser.getLanguage(req.originalUrl);
          var returnUrl = req.body.url + '/user/'+user_id + '/lang/'+lang_code + '/pttn/'+req.params.pttn_id;
          var subject = 'OLangnote - 댓글'
          var html = '';
          html += users[0].name+'님의 패턴에 '+req.session.name+'님이 댓글을 달았습니다.';
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
      sql = 'SELECT writer_id, name FROM user INNER JOIN (SELECT writer_id FROM pttn_comment WHERE pttn_id=?) AS sub_comment ON user.id=sub_comment.writer_id WHERE news_receive=1';
      var params = [ req.params.pttn_id ];
      console.log(sql, params);

      // 2-1. find relatives
      conn.query(sql, params, function(err, cmntUsers) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(cmntUsers.length == 0) { res.sendStatus(200); conn.release(); return; }
        
        var users = [];
        for(var ci in cmntUsers) {
          // 자신과 패턴 주인은 제외
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
          var returnUrl = req.body.url + '/user/'+user_id + '/lang/'+lang_code + '/pttn/'+req.params.pttn_id;
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

router.post('/:pttn_id/comment_add', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  if(!req.body.comment || req.body.comment.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'INSERT INTO pttn_comment (pttn_id, writer_id, text, reg_date) VALUES (?, ?, ?, now())';
    var params = [ req.params.pttn_id, req.session.user_id, req.body.comment ];
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

router.post('/:pttn_id/delete', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM pattern WHERE id=? AND user_id=?';
    var params = [ req.params.pttn_id, req.session.user_id ];
    console.log(sql);
    
    conn.query(sql, params, function(err, result) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.sendStatus(200);
      
      conn.release();
    });
  }); // getConnection
});

router.post('/:pttn_id/appl_comment_count_load', function(req, res) {
  var appls_id = bodyConverter.convertApplicationsId(req.body.appls_id);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    // in 을 사용한 sql이 낫나?..
    var sql = 'SELECT appl_id, COUNT(id) AS cmnt_count FROM appl_comment WHERE ';
    appls_id.forEach(function(appl_id, index) {
      if(index > 0)
        sql += ' OR ';
      sql += 'appl_id=' + mysql.escape(appl_id);
    });
    sql += ' GROUP BY appl_id';
    console.log(sql);
    
    conn.query(sql, function(err, cmnts) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.status(200).send(cmnts);
      
      conn.release();
    });
  }); // getConnection
});

router.post('/:pttn_id/linking_check', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id == user_id) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT src_id FROM pttn_copy WHERE dest_id=' + mysql.escape(req.params.pttn_id);
    console.log(sql);
    
    // 1. get source id
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var src_id = '';
      if(rows.length == 0) {
        src_id = req.params.pttn_id;
      } else if(rows.length == 1) {
        src_id = rows[0].src_id;
      }
      
      var sqlPttn = 'SELECT COUNT(*) AS pttn_count FROM pattern WHERE id=? AND user_id=?; ';
      var sqlCopy = 'SELECT COUNT(*) AS copy_count FROM pttn_copy WHERE src_id=? AND copier_id=?';
      sql = sqlPttn + sqlCopy;
      var params = [ src_id, req.session.user_id, src_id, req.session.user_id ];
      console.log(sql, params);
      
      // 2. check whether it's from me or I've copied the pattern before
      conn.query(sql, params, function(err, rows) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        if(rows[0][0].pttn_count == 1 || rows[1][0].copy_count == 1)
          res.status(200).send('true');
        else
          res.status(200).send('false');
        
        conn.release();
      });
    });
  }); // getConnection
});

router.post('/:pttn_id/quiz_count_load', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    
    var sql = 'SELECT src_id FROM pttn_copy WHERE dest_id='+mysql.escape(req.params.pttn_id);
    console.log(sql);
    
    // 1. get source id
    conn.query(sql, function(err, copies) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var src_id = '';
      if(copies.length == 0) {
        src_id = req.params.pttn_id;
      } else if(copies.length == 1) {
        src_id = copies[0].src_id;
      }
       
      sql = 'SELECT COUNT(id) AS quiz_count FROM application WHERE \
(pttn_id IN (SELECT dest_id AS pttn_id FROM pttn_copy WHERE src_id=?) OR \
pttn_id IN (SELECT src_id AS pttn_id FROM pttn_copy WHERE src_id=?)) AND \
id NOT IN (SELECT id FROM application WHERE pttn_id=? AND user_id=?) AND \
id NOT IN (SELECT src_id AS id FROM appl_copy WHERE copier_id=?) AND \
id NOT IN (SELECT dest_id AS id FROM appl_copy)';
      var params = [ src_id, src_id, req.params.pttn_id, req.session.user_id, req.session.user_id ];
      console.log(sql);
      
      // 2. get quiz - (복사되거나 복사한 패턴에 속해야함) and 내가 가진 예문은 아니어야 함 and 나에 의해서 이미 복사된 예문이 아니어야 함 and 복사본이 아니어야 함(최초 예문이 아니어야 함).
      conn.query(sql, params, function(err, quizzes) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        res.status(200).send({ quiz_count: quizzes[0].quiz_count });
        
        conn.release();
      });
    });
  }); // getConnection
});


router.get('/:pttn_id', function(req, res) {
  var user_id = urlParser.getUser(req.originalUrl);
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'pttn');
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlUser = 'SELECT name FROM user WHERE id=' + mysql.escape(user_id) + '; ';
    var sqlPttnAndAppls = sqlHelper.selectPttnAndAppls(req.params.pttn_id);
    var sqlPttnCopy = 'SELECT COUNT(*) AS copy_count FROM pttn_copy WHERE src_id='+mysql.escape(req.params.pttn_id) + ' OR dest_id='+mysql.escape(req.params.pttn_id) + '; '
    var sqlPttnCmnts = 'SELECT pttn_comment.id AS cmnt_id, pttn_id, writer_id, name, text, pttn_comment.reg_date FROM pttn_comment INNER JOIN user ON pttn_comment.writer_id=user.id WHERE pttn_id=' + mysql.escape(req.params.pttn_id) + 'ORDER BY pttn_comment.reg_date;'; 
    var sql = sqlUser + sqlPttnAndAppls + sqlPttnCopy + sqlPttnCmnts;
    console.log(sql);
    
    // 1. get basic info (user name, pattern, applications, case of copy)
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var users = rows[0];
      var pttns = rows[1];
      var appls = rows[2];
      if(users.length != 1 || pttns.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
      
      var pttn = pttns[0];
      pttn.comments = rows[4];
      var pttnCopied = (rows[3][0].copy_count > 0);
      var render = function() {
        res.render('pattern_appls', {
          title: pttn.text,
          header: users[0].name,
          auth: (req.session.user_id == user_id),
          login: (req.session.user_id != null),
          pttn: pttn,
          appls: appls,
          copy: pttnCopied,
          id: req.session.user_id
        });
      }
      
      sql = 'SELECT src_id, dest_id FROM appl_copy WHERE ';
      var quizCount = 0;
      appls.forEach(function(appl, index) {
        appl.src_exist = false;
        if(appl.quiz == 1) {
          if(quizCount > 0)
            sql += ' OR ';
          sql += 'dest_id=' + mysql.escape(appl.id);
          quizCount++;
        }
      });
      console.log(sql);
      
      if(!pttnCopied || appls.length == 0 || quizCount == 0) { render(); conn.release(); return; }
    
      // 2. get source id
      conn.query(sql, function(err, applCopies) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        sql = 'SELECT name, appl.id AS appl_id, user_id, pttn_id FROM user INNER JOIN (SELECT id, user_id, pttn_id FROM application WHERE ';
        var srcApplCount = 0;
        appls.forEach(function(appl) {
          for(var i in applCopies) {
            if(applCopies[i].dest_id == appl.id) {
              appl.src_exist = true;
              appl.src_id = applCopies[i].src_id;
              if(srcApplCount > 0)
                sql += ' OR ';
              sql += 'id=' + mysql.escape(appl.src_id);
              srcApplCount++;
              break;
            }
          }
        });
        sql += ') AS appl ON user.id=appl.user_id';
        console.log(sql);
        
        if(applCopies.length == 0) { render(); conn.release(); return; }
        
        // 3. get source user name and pattern id
        conn.query(sql, function(err, srcUserAppls) {
          if(err) { console.error(err); conn.destroy(); throw err; }
          appls.forEach(function(appl) {
            for(var ui in srcUserAppls) {
              if(srcUserAppls[ui].appl_id == appl.src_id) {
                appl.src_user_name = srcUserAppls[ui].name;
                appl.src_user_id = srcUserAppls[ui].user_id;
                appl.src_pttn_id = srcUserAppls[ui].pttn_id;
                break;
              }
            }
          });
          render();
          
          conn.release();
        }); // 3.
      }); // 2.
    }); // 1.
  }); // getConnection
});

router.get('/', function(req, res) {
	var user_id = urlParser.getUser(req.originalUrl);
	var lang_code = urlParser.getLanguage(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT id FROM pattern WHERE user_id=? AND lang_code=? ORDER BY reg_date DESC';
    var params = [ user_id, lang_code ];
    console.log(sql);
    
    conn.query(sql, params, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.redirect(req.baseUrl + '/'+rows[0].id);
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
