var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var mysqlConnector = require('./routes/util/mysql_connector');
mysqlConnector.initPool();

var patternNew = require('./routes/pattern_new');
var login = require('./routes/login');
var forgot = require('./routes/forgot');
var register = require('./routes/register');
var user = require('./routes/user');
var userModify = require('./routes/user_modify');
var friendship = require('./routes/friendship');
var allAnswers = require('./routes/all_answers');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'hulku84',
  resave: false,
  saveUninitialized: true
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.all('*', function(req, res, next) {
  var header = req.header('User-Agent');
  var mozillarVer = header[('Mozilla/').length];
  if(mozillarVer < 5) {
    res.send('need Exlplorer 11 or Firefox 5');
    return;
  }
  next();
});

app.use('/pattern_new', patternNew);
app.use('/login', login);
app.use('/forgot', forgot);
app.use('/register', register);
app.use('/user', user);
app.use('/user_modify', userModify);
app.use('/friendship', friendship);
app.use('/all_answers', allAnswers);

app.post('/logout', function(req, res) {
  //if(!req.session.user_id) { res.sendStatus(400); return; }
  req.session.destroy();
  res.sendStatus(200);
});

app.get('/home', function(req, res) {
  if(req.session.user_id)
    res.redirect('/user/'+req.session.user_id);
  else
    res.redirect('/login');
});

app.get('/agreement1', function(req, res) {
  res.render('agreement1', {
    title: 'OLangNote',
    header: '',
    login: (req.session.user_id != null)
  });
});

app.get('/agreement2', function(req, res) {
  res.render('agreement2', {
    title: 'OLangNote',
    header: '',
    login: (req.session.user_id != null)
  });
});

app.get('/usage', function(req, res) {
  res.render('usage', {
    title: 'OLangNote',
    header: '',
    login: (req.session.user_id != null)
  })
});

app.get('/', function(req, res) {
  res.render('main', {
    title: 'OLangNote',
    header: '',
    login: (req.session.user_id != null)
  })
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

process.on('exit', function() {
  console.log('bye bye');
  mysqlConnector.endPool();
});

module.exports = app;
