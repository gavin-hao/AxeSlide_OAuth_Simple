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
const userInfoUrl = "http://accounts.axeslide.com/api/userinfo";


/* GET home page. */
router.get('/', function (req, res, next) {

  res.render('index', { title: 'Express', user: req.user });
});

// 第一步：请求CODE
// redirect_uri 必须填写，与axeslide 开发者中注册的 地址一致
//  https://accounts.axeside.com/oauth/authorize?client_id=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&state=STATE
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

// code 换取access_token
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
    // 第二步：通过code获取access_token
    //POST http://accounts.axeslide.com/oauth/token；
    // request body: grant_type=authorization_code&code=your_code&redirect_uri=your_redirect_uri&client_id=appid&client_secret=appsecret
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

    // GET http://accounts.axeslide.com/api/userinfo HTTP/1.1
    // Host: http://accounts.axeslide.com/api/userinfo
    // Authorization: Bearer your_access_token
    var user_response = yield _request({ uri: userInfoUrl, method: 'GET', headers: { Authorization: 'Bearer ' + accessToken } });
    if (user_response.response.statusCode >= 400) {
      return res.redirect('/auth/fail?error=' + JSON.parse(user_response.body).error);
    }
    var profile = JSON.parse(user_response.body);

    yield tokenStore.saveToken(profile.id, token);
    req.logIn(profile);
    res.redirect('/');

  }).catch(err => next(err));
});

router.get('/profile', authorize(), function (req, res, next) {
  co(function* () {
    var url = "http://openapi.axeslide.com/api/v1/Author/Articles?skip=0&rows=20";
    var tokenData = yield tokenStore.getToken(req.user.id);
    if (!tokenData) {
      req.session['user'] = null;
      delete req.user;
      return res.redirect('/');
    }
    var token = new AccessToken(tokenData)
    if (!token.isValid()) {
      //todo refresh token;
      var params = {
        client_id: axeslide.appid,
        client_secret: axeslide.appsecret,
        grant_type: 'refresh_token',
        refresh_token: token.data.refresh_token,
        redirect_uri: req.protocol + '://' + req.get('Host') + '/auth/callback'
      };
      var tokenResp = yield _request({ uri: tokenUrl, method: 'POST', form: params });
      var dd = JSON.parse(tokenResp.body);

      yield tokenStore.saveToken(req.user.id, dd);
    }
    var newToken = yield tokenStore.getToken(req.user.id);
    token = new AccessToken(newToken)
    var resp = yield _request({ uri: url, method: 'GET', headers: { Authorization: 'Bearer ' + token.data.access_token } });
    var articles = JSON.parse(resp.body);
    var data = [];
    if (articles.Value && articles.Value.Articles)
      data = articles.Value.Articles;
    return res.render('profile', { title: 'profile', user: req.user, data: data || [] });

  })
})
router.get('/download', authorize(), function (req, res, next) {
  co(function* () {
    var d = yield tokenStore.getToken(req.user.id);
    var token = new AccessToken(d);
    var docId = req.query.id || '';
    var url = "http://openapi.axeslide.com/api/v1/Article/" + docId + "/downloadurl";
    var resp = yield _request({ uri: url, method: 'GET', headers: { Authorization: 'Bearer ' + token.data.access_token } });
    var dldUrl = JSON.parse(resp.body).Value;
    return res.redirect(dldUrl);
  })
});
router.get('/detail', authorize(), function (req, res, next) {
  co(function* () {
    var d = yield tokenStore.getToken(req.user.id);
    var token = new AccessToken(d);
    var docId = req.query.id || '';
    var url = "http://openapi.axeslide.com/api/v1/Article/" + docId ;
    var resp = yield _request({ uri: url, method: 'GET', headers: { Authorization: 'Bearer ' + token.data.access_token } });
    var data = JSON.parse(resp.body).Value;
    return res.render('detail', { title: 'profile', user: req.user, data: data || [] });
  })
});
router.get('/auth/fail', function (req, res, next) {
  return res.status(401).render('authfail', { title: '授权失败' });
})

router.get('/logout', function (req, res, next) {
  req.session['user'] = null;
  delete req.user;
  return res.redirect('/');
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
