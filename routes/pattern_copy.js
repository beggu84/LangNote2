var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();
 
var urlParser = require('./util/url_parser');

router.post('/', function(req, res) {
  if(!req.session.user_id) { res.sendStatus(400); return; }
  
  var pttn_id = urlParser.getPattern(req.originalUrl);
  var lang_code = urlParser.getLanguage(req.originalUrl);
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT src_id FROM pttn_copy WHERE dest_id=' + mysql.escape(pttn_id);
    console.log(sql);
    
    // 1. get source id
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      var src_id = '';
      if(rows.length == 0) {
        src_id = pttn_id;
      } else if(rows.length == 1) {
        src_id = rows[0].src_id;
      }
      
      /*
      var sqlPttn = 'SELECT COUNT(*) AS pttn_count FROM pattern WHERE id=? AND user_id=?; ';
      var sqlCopy = 'SELECT COUNT(*) AS copy_count FROM pttn_copy WHERE src_id=? AND copier_id=?; ';
      var sqlLang = 'SELECT COUNT(*) AS lang_count FROM language WHERE code=? AND user_id=?'; 
      sql = sqlPttn + sqlCopy + sqlLang;
      var params = [ src_id, req.session.user_id, src_id, req.session.user_id, lang_code, req.session.user_id ];
      */
      var sql = 'SELECT COUNT(*) AS lang_count FROM language WHERE code=? AND user_id=?';
      var params = [ lang_code, req.session.user_id ];
      console.log(sql, params);
      
      // 2. check whether it's from me or I've copied the pattern before and whether I've had this language
      conn.query(sql, params, function(err, langs) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        /*
        if(rows[0][0].pttn_count == 1) {
          res.status(200).send({ result: 'mine' });
          conn.release();
          return;
        }
        if(rows[1][0].copy_count == 1) {
          res.status(200).send({ result: 'already' });
          conn.release();
          return;
        }
        */
        
        conn.beginTransaction(function(err) {
          if(err) { console.error(err); conn.destroy(); throw err; }
          var sqlLangInsert = 'INSERT INTO language VALUES ('+mysql.escape(lang_code)+', '+mysql.escape(req.session.user_id)+', now()); ';
          var sqlPttnInsert = 'INSERT INTO pattern (user_id, lang_code, text, mean, reg_date) VALUES (?, ?, ?, ?, now()); ';
          //var hasLang = (rows[2][0].lang_count == 1);
          var hasLang = (langs[0].lang_count == 1);
          if(hasLang)
            sql = sqlPttnInsert;
          else
            sql = sqlLangInsert + sqlPttnInsert;
          params = [ req.session.user_id, lang_code, req.body.text, req.body.mean ]; 
          console.log(sql, params);
          
          // 3. copy
          conn.query(sql, params, function(err, results) {
            if(err) {
              return conn.rollback(function() {
                console.error(err);
                conn.destroy();
                throw err;
              });
            }
            
            var dest_id = null;
            if(hasLang)
              dest_id = results.insertId;
            else
              dest_id = results[1].insertId;
            
            // 4. insert meta data
            sql = 'INSERT INTO pttn_copy VALUES (?, ?, ?)';
            params = [ src_id, dest_id, req.session.user_id ];
            console.log(sql);
            
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
                
                res.status(200).send({
                  result: 'success',
                  user_id: req.session.user_id,
                  lang_code: lang_code,
                  copied_id: dest_id
                });
                
                conn.release();
              }); // commit
            }); // 4.
          }); // 3.
        }); // beginTransaction
      }); // 2.
    }); // 1.
  }); // getConnection
});

module.exports = router;
