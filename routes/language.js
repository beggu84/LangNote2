var express = require('express');
var router = express.Router();

var pattern = require('./pattern_appls'); 
router.use('/:lang_code/pttn', pattern);

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var langJson = require('./util/lang_json');
var sqlHelper = require('./util/sql_helper');
var urlParser = require('./util/url_parser');
var bodyConverter = require('./util/body_converter');

router.post('/:lang_code/pttn_delete', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  var pttns_id = bodyConverter.convertPatternsId(req.body.pttns_id);
  if(pttns_id.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'DELETE FROM pattern WHERE user_id='+mysql.escape(req.session.user_id) + ' AND (';
    pttns_id.forEach(function(item, index) {
      if(item.length == 0) { res.sendStatus(400); conn.release(); return; }
      if(index > 0)
        sql += ' OR ';
      sql += 'id=' + mysql.escape(item);
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

router.post('/:lang_code/linking_check', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  var user_id = urlParser.getUser(req.originalUrl);
  if(req.session.user_id == user_id) { res.sendStatus(400); return; }
  
  var pttns_id = bodyConverter.convertPatternsId(req.body.pttns_id);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT src_id, dest_id FROM pttn_copy WHERE ';
    pttns_id.forEach(function(pttn_id, index) {
      if(index > 0)
        sql += ' OR ';
      sql += 'dest_id='+mysql.escape(pttn_id);
    });
    console.log(sql);
    
    // 1. get source id
    conn.query(sql, function(err, copies) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var pttns = [];
      pttns_id.forEach(function(pttn_id) {
        var pttn = { id: pttn_id };
        pttn.src_id = pttn_id;
        for(var i in copies) {
          if(pttn_id == copies[i].dest_id) {
            pttn.src_id = copies[i].src_id;
            break;
          }
        }
        pttns.push(pttn);
      });
      
      var sqlPttn = 'SELECT id, COUNT(id) AS pttn_count FROM pattern WHERE user_id='+mysql.escape(req.session.user_id) + ' AND (';
      var sqlCopy = 'SELECT src_id, COUNT(src_id) AS copy_count FROM pttn_copy WHERE copier_id='+mysql.escape(req.session.user_id) + ' AND (';
      pttns.forEach(function(pttn, index) {
        if(index > 0) {
          sqlPttn += ' OR ';
          sqlCopy += ' OR ';
        }
        sqlPttn += 'id='+mysql.escape(pttn.src_id);
        sqlCopy += 'src_id='+mysql.escape(pttn.src_id);
      });
      sqlPttn += ') GROUP BY id; ';
      sqlCopy += ') GROUP BY src_id;';
      sql = sqlPttn + sqlCopy;
      console.log(sql);
      
      // 2. check whether it's from me or I've copied the pattern before
      conn.query(sql, function(err, rows) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        var pttns_count = rows[0];
        var pttns_copy = rows[1];
        pttns.forEach(function(pttn) {
          pttn.linking = false;
          for(var i in pttns_count) {
            if(pttn.src_id == pttns_count[i].id && pttns_count[i].pttn_count == 1) {
              pttn.linking = true;
              break; 
            }
          }
          if(!pttn.linking) {
            for(var i in pttns_copy) {
              if(pttn.src_id == pttns_copy[i].src_id && pttns_copy[i].copy_count == 1) {
                pttn.linking = true;
                break; 
              }
            }
          }
        });
        
        res.status(200).send(pttns);
        
        conn.release();
      });
    });
  }); // getConnection
});

router.post('/:lang_code/quiz_count_load', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  var pttns_id = bodyConverter.convertPatternsId(req.body.pttns_id);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT src_id, dest_id FROM pttn_copy WHERE ';
    pttns_id.forEach(function(pttn_id, index) {
      if(index > 0)
        sql += ' OR ';
      sql += '(dest_id='+mysql.escape(pttn_id) + ' OR src_id='+mysql.escape(pttn_id)+')';
    });
    console.log(sql);
    
    conn.query(sql, function(err, copies) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var pttns = [];
      pttns_id.forEach(function(pttn_id) {
        var pttn = { id: pttn_id };
        pttn.copied = false;
        pttn.quiz_count = 0;
        for(var i in copies) {
          if(pttn_id == copies[i].src_id) {
            pttn.copied = true;
            pttn.src_id = pttn_id;
            break;
          } else if(pttn_id == copies[i].dest_id) {
            pttn.copied = true;
            pttn.src_id = copies[i].src_id;
            break;
          }
        }
        pttns.push(pttn);
      });
      
      sql = '';
      pttns.forEach(function(pttn) {
        if(pttn.copied) {
          sql += 'SELECT COUNT(id) AS quiz_count FROM application WHERE \
(pttn_id IN (SELECT dest_id AS pttn_id FROM pttn_copy WHERE src_id='+mysql.escape(pttn.src_id)+') OR \
pttn_id IN (SELECT src_id AS pttn_id FROM pttn_copy WHERE src_id='+mysql.escape(pttn.src_id)+')) AND \
id NOT IN (SELECT id FROM application WHERE pttn_id='+mysql.escape(pttn.id)+' AND user_id='+mysql.escape(req.session.user_id)+') AND \
id NOT IN (SELECT src_id AS id FROM appl_copy WHERE copier_id='+mysql.escape(req.session.user_id)+') AND \
id NOT IN (SELECT dest_id AS id FROM appl_copy); ';
        }
      });
      if(sql.length == 0) { res.status(200).send(pttns); conn.release(); return; }
      console.log(sql);
      
      conn.query(sql, function(err, quizzes) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        var index = 0;
        pttns.forEach(function(pttn) {
          if(pttn.copied) {
            if(quizzes.length == 1)
              pttn.quiz_count = quizzes[index].quiz_count; // == quizzes[0]
            else // quizzes.length > 1
              pttn.quiz_count = quizzes[index][0].quiz_count;
            index++; 
          }
        });
      
        res.status(200).send(pttns);
        
        conn.release();
      });
    });
  }); // getConnection
});

router.get('/:lang_code', function(req, res) {
	var user_id = urlParser.getUser(req.originalUrl);
  var redirectUrl = urlParser.cutBack(req.originalUrl, 'lang');
  
  if(!langJson.exist(req.params.lang_code)) { res.redirect(redirectUrl); return; }
  res.cookie('recent_language', req.params.lang_code);
	
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sqlUser = 'SELECT name FROM user WHERE id=' + mysql.escape(user_id) + '; '
    var sqlPttns = 'SELECT P.id, P.text, P.mean, COUNT(A.id) AS appl_count FROM ' + sqlHelper.subSelectPttnWhereUserIdAndLangCode(user_id, req.params.lang_code) + ' AS P LEFT JOIN ' + sqlHelper.subSelectApplWhereUserId(user_id) + ' AS A ON P.id=A.pttn_id GROUP BY P.id ORDER BY P.reg_date DESC;';
    var sql = sqlUser + sqlPttns;
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var users = rows[0];
      if(users.length != 1) { res.redirect(redirectUrl); conn.release(); return; }
      
      res.render('pattern_list', {
        title: users[0].name + ' - ' + langJson.getName(req.params.lang_code),
        header: users[0].name,
        auth: (req.session.user_id == user_id),
        login: (req.session.user_id != null),
        pttns: rows[1]
      });
      
      conn.release();
    });
  }); // getConnection
});

router.get('/', function(req, res) {
  var user_id = urlParser.getUser(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT lang_code FROM pattern WHERE user_id='+mysql.escape(user_id) + ' ORDER BY reg_date DESC';
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      res.redirect(req.baseUrl + '/'+rows[0].lang_code);
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
