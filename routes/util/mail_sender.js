var nodemailer = require('nodemailer');
// https://www.google.com/settings/security/lesssecureapps '여기서 보안 수준이 낮은 앱의 액세스' 사용 해야함.

var sender = 'OLangNote2@gmail.com';
var receiver = '';

function getTransport() {
  return nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'OLangNote2@gmail.com',
      pass: '******'
    }
  });
}

exports.transportText = function(subject, text) {
  var mailOptions = {
    from: sender,
    to: receiver,
    subject: subject,
    text: text
  };
  
  sendMail(mailOptions);
}

exports.transportHtml = function(subject, html) {
  var mailOptions = {
    from: sender,
    to: receiver,
    subject: subject,
    html: html
  };
  
  sendMail(mailOptions);
}

function sendMail(mailOptions) {
  var transport = getTransport();
  
  transport.sendMail(mailOptions, function(err, info) {
    if(err) { 
      console.log(err);
    } else {
      console.log("message sent: " + info.response);
    }
    
    transport.close();
  });
}