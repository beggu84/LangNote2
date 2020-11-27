var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

router.get('/:appl_id', function(req, res) {
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT mean FROM application WHERE application.id='+mysql.escape(req.params.appl_id);
    console.log(sql);
    
    conn.query(sql, function(err, appls) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(appls.length != 1) { res.sendStatus(400); conn.release(); return; }
      
      sql = 'SELECT application.id AS appl_id, text AS answer, user.id AS user_id, name FROM application INNER JOIN user ON application.user_id=user.id WHERE application.id IN (SELECT dest_id AS id FROM appl_copy WHERE src_id=?) OR application.id=?';
      var params = [ req.params.appl_id, req.params.appl_id ];
      console.log(sql, params);
      
      conn.query(sql, params, function(err, rows) {
        if(err) { console.error(err); conn.destroy(); throw err; }
        res.render('all_answers', {
          title: appls[0].mean,
          header: '',
          login: (req.session.user_id != null),
          quiz: appls[0].mean,
          applUsers: rows          
        });
        
        conn.release();
      });
    });
  }); // getConnection
});

// click user name
router.post('/:appl_id', function(req, res) {
  if(!req.body.appl_id || req.body.appl_id.length == 0 ||
     !req.body.user_id || req.body.user_id.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var sql = 'SELECT id, lang_code FROM pattern WHERE id IN (SELECT pttn_id AS id FROM application WHERE id=?) AND user_id=?';
    var params = [ req.body.appl_id, req.body.user_id ];
    console.log(sql, params);
    
    conn.query(sql, params, function(err, pttns) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(pttns.length != 1) { res.sendStatus(400); conn.release(); return; }
        
      res.status(200).send({
        pttn_id: pttns[0].id,
        lang_code: pttns[0].lang_code
      });
    
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
