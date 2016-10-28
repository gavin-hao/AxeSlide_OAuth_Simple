
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

exports.saveToken = function (key, token) {
    store[key] = token;
}
exports.getToken = function (key) {
    return store[key]
}