'use strict';

var events = require('events'),
    util = require('util');

var EventEmitter = events.EventEmitter;

var Client = function (req, res) {
  this.req = req;
  this.res = res;
};

util.inherits(Client, EventEmitter);

Client.prototype.send = function (data) {
  if (typeof data !== 'object') {
    throw new Error('Data must be an object.');
  }
  if (data === null) {
    throw new Error('Data must not be null.');
  }

  this.res.write(JSON.stringify(data) + '\n');
};

Client.prototype.close = function () {
  this.res.end();
  this.res.removeAllListeners();
};

module.exports = Client;
