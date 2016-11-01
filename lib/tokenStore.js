
var co = require('co');
var fs = require('fs');
var store = {};
var AccessToken = exports.AccessToken = function (data) {
    if (!(this instanceof AccessToken)) {
        return new AccessToken(data);
    }
    this.data = data;
};
AccessToken.prototype.isValid = function () {
    return !!this.data.access_token && (new Date().getTime()) < (this.data.create_at + this.data.expires_in * 1000);
};

function readFile(key) {
    return new Promise((resolve, reject) => {
        fs.readFile(key + ':access_token.txt', 'utf8', function (err, txt) {
            if (err) { return reject(err); }
            return resolve(txt);
        })
    })
}
function writeFile(key, token) {
    return new Promise((resolve, reject) => {
        fs.writeFile(key + ':access_token.txt', JSON.stringify(token), function (err) {
            if (err) { return reject(err); }
            return resolve(true);
        })
    })
}
exports.saveToken = function (key, token) {
    token.create_at = Date.now();
    return writeFile(key, token)
    // store[key] = token;
}
exports.getToken = function (key) {
    
    //return store[key]
    return new Promise((resolve, reject) => {
        readFile(key).then(function (data) {
            var t = JSON.parse(data)
            return resolve(t);
        }, function (err) {
            return reject(err);
        })
    })
}