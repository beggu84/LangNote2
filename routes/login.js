var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var mysqlConnector = require('./util/mysql_connector');
var pool = mysqlConnector.getPool();

var hashMaker = require('./util/hash_maker');

router.get('/', function(req, res) {
  var render = function(name) {
    res.render('login', {
      title: '로그인',
      header: '로그인',
      login: (req.session.user_id != null),
      name: name
    });
  }
  
  if(req.session.user_id == null) // logouted
    render('');
  else // logined
    render(req.session.name);
});

router.post('/', function(req, res) {
  if(!req.body.id || req.body.id.length == 0 ||
     !req.body.password || req.body.password.length == 0) { res.sendStatus(400); return; }
  
  pool.getConnection(function(err, conn) {
    if(err) { console.error(err); throw err; }
    var shaPassword = hashMaker.sha256(req.body.password);
    
    var sql = 'SELECT name FROM user WHERE id='+mysql.escape(req.body.id) + ' AND password='+mysql.escape(shaPassword);
    console.log(sql);
    
    conn.query(sql, function(err, rows) {
      if(err) { console.error(err); conn.destroy(); throw err; }
      if(rows.length != 1) {
        res.status(200).send({ result: 'fail' });
        conn.release();
        return;
      }
      
      req.session.user_id = req.body.id;
      req.session.name = rows[0].name;
      
      var homeUrl = '/user/' + req.body.id;
      var resultUrl = homeUrl;
      if(req.cookies.goHomeAfterLogin == 1) {
        console.log('goHomeAfterLogin: ' + req.cookies.goHomeAfterLogin);
        res.cookie('goHomeAfterLogin', 0);
        resultUrl = homeUrl;
      } else {
        if(req.cookies.urlBeforeLogin && req.cookies.urlBeforeLogin.length > 0) {
          console.log('go urlBeforeLogin - ' + req.cookies.urlBeforeLogin);
          resultUrl = req.cookies.urlBeforeLogin;
        }
      }
      
      res.status(200).send({
        result: 'success',
        url: resultUrl 
      });
      
      conn.release();
    });
  }); // getConnection
});

module.exports = router;
