exports.convertLanguagesCode = function(bodyLangsCode) {
	var langs_code = [];
  if(typeof(bodyLangsCode) == 'string') {
    langs_code.push(bodyLangsCode);
  } else if(typeof(bodyLangsCode) == 'object') {
    for(var i in bodyLangsCode)
      langs_code.push(bodyLangsCode[i]);
  }
  return langs_code;
}

exports.convertPatternsId = function(bodyPttnsId) {
	var pttns_id = [];
  if(typeof(bodyPttnsId) == 'string') {
    pttns_id.push(bodyPttnsId);
  } else if(typeof(bodyPttnsId) == 'object') {
    for(var i in bodyPttnsId)
      pttns_id.push(bodyPttnsId[i]);
  }
  return pttns_id;
}

exports.convertApplicationsId = function(bodyApplsId) {
	var appls_id = [];
  if(typeof(bodyApplsId) == 'string') {
    appls_id.push(bodyApplsId);
  } else if(typeof(bodyApplsId) == 'object') {
    for(var i in bodyApplsId)
      appls_id.push(bodyApplsId[i]);
  }
  return appls_id;
}

exports.convertApplications = function(body) {
	var newAppls = [];
  if(typeof(body.appl_text) == 'string') {
    newAppls.push({ text: body.appl_text, mean: body.appl_mean });
  } else if(typeof(body.appl_text) == 'object') {
    for(var i in body.appl_text)
      newAppls.push({ text: body.appl_text[i], mean: body.appl_mean[i] });
  }
  return newAppls;
}

exports.convertApplications2 = function(body) {
	var newAppls = [];
  if(typeof(body.appls_id) == 'string') {
    newAppls.push({
      id: body.appls_id,
      text: body.appls_text,
      mean: body.appls_mean
    });
  } else if(typeof(body.appls_id) == 'object') {
    for(var i in body.appls_id)
      newAppls.push({
        id: body.appls_id[i],
        text: body.appls_text[i],
        mean: body.appls_mean[i]
      });
  }
  return newAppls;
}