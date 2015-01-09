var querystring = require("querystring");
var https = require('https');
var _ = require('underscore');
var crypto = require('crypto');

_.mixin({
  // compact for objects
  compactObject: function(to_clean) {
    _.map(to_clean, function(value, key, to_clean) {
      if (value === undefined)
        delete to_clean[key];
    });
    return to_clean;
  }
});  

var Altstrade = function(publicKey, privateKey) {
  this.key = publicKey;
  this.secret = privateKey;

  _.bindAll(this);
}

Altstrade.prototype._request = function(method, path, data, callback, args) {
  
  var options = {
    host: 'alts.trade',
    path: path,
    method: method,
    headers: {
      'User-Agent': 'Mozilla/4.0 (compatible; Altstrade node.js client)'
    }
  };

  if(method === 'post') {
    options.headers['Content-Length'] = data.length;
    options.headers['content-type'] = 'application/x-www-form-urlencoded';

    options.headers['Rest-Key'] = args['Rest-Key'];
    options.headers['Rest-Sign'] = args['Rest-Sign'];
  }

  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    var buffer = '';
    res.on('data', function(data) {
      buffer += data;
    });
    res.on('end', function() {
      try {
        var json = JSON.parse(buffer);
      } catch (err) {
        return callback(err);
      }
      callback(null, json);
    });
  });

  req.on('error', function(err) {
    callback(err);
  });

  req.on('socket', function (socket) {
    socket.setTimeout(5000);
    socket.on('timeout', function() {
      req.abort();
    });
    socket.on('error', function(err) {
      callback(err);
    });
  });
  
  req.end(data);

}

// if you call new Date to fast it will generate
// the same ms, helper to make sure the nonce is
// truly unique (supports up to 999 calls per ms).
Altstrade.prototype._generateNonce = function() {
  var now = new Date().getTime();

  if(now !== this.last)
    this.nonceIncr = -1;    

  this.last = now;
  this.nonceIncr++;

  // add padding to nonce incr
  // @link https://stackoverflow.com/questions/6823592/numbers-in-the-form-of-001
  var padding = 
    this.nonceIncr < 10 ? '000' : 
      this.nonceIncr < 100 ? '00' :
        this.nonceIncr < 1000 ?  '0' : '';
  return now + padding + this.nonceIncr;
}

Altstrade.prototype._get = function(action, callback) {
  var path = '/rest_api/' + action;
  this._request('get', path, undefined, callback)
}

Altstrade.prototype._post = function(action, callback, args) {
  if(!this.key || !this.secret)
    return callback('Must provide public and private keys to make this API request.');

  var path = '/rest_api/' + action + '/';

  var nonce = this._generateNonce();
  var message = _.extend({ nonce: nonce }, args);
  message = _.compactObject(message);
  message = querystring.stringify(message);

  var secret =  new Buffer(this.secret, 'base64');
  var signer = crypto.createHmac('sha512', secret);
  var signature = new Buffer(signer.update(message).digest('binary'), 'binary').toString('base64');

  args = {
    'Rest-Key': this.key,
    'Rest-Sign': signature
  };

  args = _.compactObject(args);

  this._request('post', path, message, callback, args);
}

Altstrade.prototype.markets = function(callback) {
  this._get('markets', callback);
}

Altstrade.prototype.currencies = function(callback) {
    this._get('currencies', callback);
}

Altstrade.prototype.ticker = function(market, callback) {
  this._get('ticker/' + market, callback);
}

Altstrade.prototype.tradeHistory = function(market, callback) {
  this._get('markets/history/' + market, callback);
}

Altstrade.prototype.orderBook = function(market, callback) {
  this._get('orders/market/' + market, callback);
}

Altstrade.prototype.balance = function(callback) {
  this._post('balance', callback);
}

Altstrade.prototype.pendingDeposits = function(callback){
    this._post('deposit/pending', callback);
}

Altstrade.prototype.depositsHistory = function(callback){
    this._post('deposit/history', callback);
}

Altstrade.prototype.depositKeys = function(coinCode, callback){
    this._post('deposit/coin', callback, { code: coinCode });
}

Altstrade.prototype.pendingWithdraws = function (callback) {
    this._post('withdraw/pending', callback);
}

Altstrade.prototype.withdrawsHistory = function (callback) {
    this._post('withdraw/history', callback);
}

Altstrade.prototype.placeOrder = function (market, action, amount, price, callback) {
    this._post('orders', callback, { market: market, action: action, amount: amount, price: price.toFixed(8) });
}

Altstrade.prototype.cancelOrder = function (orderId, callback) {
    this._post('orders/cancel', callback, { order_id: orderId });
}

Altstrade.prototype.myOpenOrders = function(market, callback){
    this._post('orders/my', callback, { market: market });
}

Altstrade.prototype.allMyOpenOrders = function(callback){
    this._post('orders/my_all', callback);
}

Altstrade.prototype.myTrades = function(market, callback){
    this._post('orders/my_history', callback, { market: market });
}

module.exports = Altstrade;
