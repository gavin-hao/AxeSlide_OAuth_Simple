var express = require('express');
var router = express.Router();
var qs = require('querystring');
var request = require('request');
var debug = require('debug')('routes:index');
var axeslide = require('../config.js').axeside;
var co = require('co');
var tokenStore = require('../lib/tokenStore');
var AccessToken = tokenStore.AccessToken;

const authorieUrl = "http://accounts.axeslide.com/oauth/authorize";
const tokenUrl = "http://accounts.axeslide.com/oauth/token";
const userInfoUrl = "http://accounts.axeslide.com/api/me";


/* GET home page. */
router.get('/', function (req, res, next) {

  res.render('index', { title: 'Express', user: req.user });
});

router.get('/auth/axeslide', function (req, res, next) {
  co(function* () {
    var params = {
      client_id: axeslide.appid,
      redirect_uri: req.protocol + '://' + req.get('Host') + '/auth/callback',
      response_type: 'code',
      state: 'your-nonce',
      scope: ''
    }
    var url = authorieUrl + '?' + qs.stringify(params)
    return res.redirect(url);
  }).catch(err => next(err));

});

function _request(options) {
  return new Promise((resolve, reject) => {
    request(options, function (err, response, body) {
      if (err) {
        return reject(err);
      }
      return resolve({ response: response, body: body });
    })
  });
}
router.get('/auth/callback', function (req, res, next) {
  req.logIn = function (user) {
    req['user'] = req.session['user'] = user;

  }
  co(function* () {
    if (req.query && req.query.state && !req.query.code) {
      return res.redirect('/auth/fail');
    }

    var code = req.query.code;
    debug('wechat callback -> \n %s', req.url);
    var params = {
      client_id: axeslide.appid,
      client_secret: axeslide.appsecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: req.protocol + '://' + req.get('Host') + '/auth/callback'
    };
    var response = yield _request({ uri: tokenUrl, method: 'POST', form: params });
    if (response.response.statusCode >= 400) {
      return res.redirect('/auth/fail?error=' + JSON.parse(response.body).error);
    }
    var token = JSON.parse(response.body);
    var accessToken = token["access_token"];
    var expires = token["expires_in"];
    if (!accessToken) {
      return res.redirect('/auth/fail?error=no_accesstoken');
    }

    var user_response = yield _request({ uri: userInfoUrl, method: 'GET', headers: { Authorization: 'Bearer ' + accessToken } });
    var profile = JSON.parse(user_response.body);
    tokenStore.saveToken(profile.id, token);
    req.logIn(profile);
    res.redirect('/');

  }).catch(err => next(err));
});

router.get('/profile', authorize(), function (req, res, next) {
  return res.render('profile', { title: 'profile', user: req.user });
})

router.get('/auth/fail', function (req, res, next) {
  return res.status(401).render('authfail', { title: '授权失败' });
})



function authorize(options) {
  if (typeof options == 'string') {
    options = { redirectTo: options }
  }
  options = options || {};

  var url = options.redirectTo || '/login';
  return function (req, res, next) {
    // req['user'] = req.session['user'];
    if (req.user) {
      return next();
    }
    if (req.xhr) {
      var err = new Error('UnAuthorized');
      err.status = 401;
      return next(err);
    }
    var redirect = req.method.toUpperCase() == 'GET' ? (req.originalUrl || req.url) : '';
    res.redirect(url + '?returnTo=' + redirect)
  }
}

module.exports = router;
