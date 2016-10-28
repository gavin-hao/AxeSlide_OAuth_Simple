var express = require('express');
var router = express.Router();
var co = require('co');
var qs = require('querystring');
var request = require('request');
var tokenStore = require('../lib/tokenStore');
var AccessToken = tokenStore.AccessToken;
/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;
