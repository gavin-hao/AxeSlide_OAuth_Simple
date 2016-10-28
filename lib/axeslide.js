var request = require('request');

var extend = require('util')._extend;
var querystring = require('querystring');
const userInfoUrl = "http://accounts.axeslide.com/api/me";
var AccessToken = function (data) {
    if (!(this instanceof AccessToken)) {
        return new AccessToken(data);
    }
    this.data = data;
};
AccessToken.prototype.isValid = function () {
    return !!this.data.access_token && (new Date().getTime()) < (this.data.create_at + this.data.expires_in * 1000);
};

var processToken = function (that, callback) {
    return function (err, data, res) {
        if (err) {
            return callback(err, data);
        }
        data.create_at = new Date().getTime();
        // 存储token
        that.saveToken(data.openid, data, function (err) {
            callback(err, new AccessToken(data));
        });
    };
};
var tokenStore = {};
var Axeslide = function () {
    this.getToken = function (key) {
        return new Promise((resolve, reject) => {
            var token = tokenStore[key];
            return resolve(token);
        })
    };
    this.saveToken = function (key, token) {
        return new Promise((resolve, reject) => {
            tokenStore[key] = token;
            return resolve(token);
        })
    }
}
Axeslide.prototype.getUserInfo = function (userId) {
    var that = this;
    var promise = new Promise();
    var access_token = that.getToken(userId).then(function (data) {
        if (!data) {
            var error = new Error('No token for ' + options.openid + ', please authorize first.');
            error.name = 'NoOAuthTokenError';
            return promise.reject(error);
        }
        var token = new AccessToken(data);
        if (token.isValid()) {
            request.get(userInfoUrl, {form:{}},function(){

            })
        }
    });
}
Axeslide.prototype._request = function () {

}
Axeslide.prototype.getAuthorizeUrl = function () {

}