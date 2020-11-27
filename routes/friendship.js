var express = require('express');
var router = express.Router();

var crypto = require('crypto');
var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

router.get('/', function(req, res) {
  if(!req.session.user_id) {
    res.cookie('urlBeforeLogin', req.originalUrl);
    res.redirect('/login');
    return;
  }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    
    // to - ((user_id가 나 인 예문)을 src_id로 가지고 있는 dest_id)를 id로 가지는 user당 몇 개인지와 그 user의 이름  
    var sqlTo = 'SELECT user_id, name, to_count FROM user INNER JOIN (SELECT user_id, COUNT(user_id) AS to_count FROM application WHERE id IN (SELECT dest_id FROM appl_copy WHERE src_id IN (SELECT id AS src_id FROM application WHERE user_id=?)) GROUP BY user_id) AS friendship ON user.id=friendship.user_id; ';
    // from - ((user_id가 나 인 예문)을 dest_id로 가지고 있는 src_id)를 id로 가지는 user당 몇 개인지와 그 user의 이름
    var sqlFrom = 'SELECT user_id, name, from_count FROM user INNER JOIN (SELECT user_id, COUNT(user_id) AS from_count FROM application WHERE id IN (SELECT src_id AS id FROM appl_copy WHERE dest_id IN (SELECT id AS dest_id FROM application WHERE user_id=?)) GROUP BY user_id) AS friendship ON user.id=friendship.user_id';
    var sql = sqlTo + sqlFrom;
    var params = [ req.session.user_id, req.session.user_id ];
    
    conn.query(sql, params, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }

      var fships = rows[0];
      fships.forEach(function(item) {
        item.from_count = 0;
      });
      
      var froms = rows[1];
      froms.forEach(function(item) {
        var exist = false;
        for(var i in fships) {
          if(item.user_id == fships[i].user_id) {
            exist = true;
            break;
          }
        }
        if(exist) {
          fships[i].from_count = item.from_count;
        } else {
          item.to_count = 0;
          fships.push(item);
        }
      });
    
      res.render('friendship', {
        title: '프랜드쉽',
        header: '프랜드쉽',
        login: (req.session.user_id != null),
        fships: fships
      });
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
