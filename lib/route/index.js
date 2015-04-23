'use strict';

var Timer = require('timer2');

var Client = require('./Client');

var setupRoute = function (timeout) {
  var heartbeatTimer = new Timer(timeout * 1000);

  var route = function (callback) {
    return function (req, res) {
      var client = new Client(req, res);

      var sendHeartbeat = function () {
        client.send({ name: 'heartbeat' });
      };

      req.setTimeout(0);
      res.setTimeout(0);

      heartbeatTimer.on('tick', sendHeartbeat);
      res.socket.once('close', function () {
        heartbeatTimer.removeListener('tick', sendHeartbeat);
        client.emit('close');
        client.removeAllListeners();
      });

      res.writeHead(200, {
        'content-type': 'application/json',
        'transfer-encoding': 'chunked'
      });

      callback(client);
      client.emit('open');
    };
  };

  return route;
};

module.exports = setupRoute;
