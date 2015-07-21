'use strict';

var http = require('http');

var assert = require('assertthat'),
    bodyParser = require('body-parser'),
    express = require('express'),
    Timer = require('timer2');

var route = require('../lib/route')(1.5);

suite('route', function () {
  var app,
      port = 3000;

  setup(function () {
    app = express();
    app.use(bodyParser.json());
    http.createServer(app).listen(++port);
  });

  teardown(function () {
    app = undefined;
  });

  test('is a function.', function (done) {
    assert.that(route).is.ofType('function');
    done();
  });

  test('returns a 405 if GET is used.', function (done) {
    app.get('/', route(function () {
      // Intentionally left blank...
    }));

    http.request({
      method: 'GET',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      assert.that(res.statusCode).is.equalTo(405);
      assert.that(res.headers.allow).is.equalTo('POST, OPTIONS');
      done();
    }).end();
  });

  test('emits a connect event when the client connects.', function (done) {
    app.post('/', route(function (client) {
      client.once('connect', function () {
        done();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    }).end();
  });

  test('passes the request body to the client object.', function (done) {
    var req;

    app.post('/', route(function (client) {
      client.once('connect', function () {
        assert.that(client.req.body).is.equalTo({
          foo: 'bar'
        });
        done();
      });
    }));

    req = http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/',
      headers: {
        'content-type': 'application/json'
      }
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    });

    req.write(JSON.stringify({
      foo: 'bar'
    }));
    req.end();
  });

  test('emits a disconnect event when the client disconnects.', function (done) {
    app.post('/', route(function (client) {
      client.once('disconnect', function () {
        done();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    }).end();
  });

  test('is able to disconnect a client.', function (done) {
    app.post('/', route(function (client) {
      client.once('connect', function () {
        client.send({ foo: 'bar' });
        client.disconnect();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      res.once('data', function (data1) {
        res.once('data', function (data2) {
          res.once('end', function () {
            done();
          });
          assert.that(JSON.parse(data2.toString())).is.equalTo({ foo: 'bar' });
        });
        assert.that(JSON.parse(data1.toString())).is.equalTo({ name: 'heartbeat' });
      });
    }).end();
  });

  test('emits a disconnect event when the client is disconnected from the server.', function (done) {
    app.post('/', route(function (client) {
      client.once('connect', function () {
        client.disconnect();
      });

      client.once('disconnect', function () {
        done();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    }).end();
  });

  test('cleans up when the client disconnects.', function (done) {
    app.post('/', route(function (client) {
      client.on('connect', function () {
        // Intentionally left blank...
      });

      client.on('disconnect', function () {
        process.nextTick(function () {
          assert.that(client.listeners('connect').length).is.equalTo(0);
          assert.that(client.listeners('disconnect').length).is.equalTo(0);
          done();
        });
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 500);
    }).end();
  });

  test('sends heartbeats.', function (done) {
    var counter = 0;

    this.timeout(5 * 1000);

    app.post('/', route(function () {
      // Intentionally left blank ;-)
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      res.on('data', function (data) {
        var result = JSON.parse(data.toString());

        assert.that(result.name).is.equalTo('heartbeat');
        counter++;

        if (counter === 3) {
          res.socket.end();
          res.removeAllListeners();
          done();
        }
      });
    }).end();
  });

  test('streams data.', function (done) {
    app.post('/', route(function (client) {
      var counter = 0,
          timer = new Timer(100);

      client.once('connect', function () {
        timer.on('tick', function () {
          client.send({ counter: counter++ });
        });
      });

      client.once('disconnect', function () {
        timer.destroy();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      res.on('data', function (data) {
        var result = JSON.parse(data.toString());

        if (result.name === 'heartbeat') {
          return;
        }
        assert.that(result.counter).is.between(0, 9);

        if (result.counter === 9) {
          res.socket.end();
          res.removeAllListeners();
          done();
        }
      });
    }).end();
  });

  test('handles newlines in data gracefully.', function (done) {
    app.post('/', route(function (client) {
      client.once('connect', function () {
        client.send({ text: 'foo\nbar' });
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      res.on('data', function (data) {
        var result = JSON.parse(data.toString());

        if (result.name === 'heartbeat') {
          return;
        }
        assert.that(result).is.equalTo({
          text: 'foo\nbar'
        });

        res.socket.end();
        res.removeAllListeners();
        done();
      });
    }).end();
  });

  test('throws an error if data is not an object.', function (done) {
    app.post('/', route(function (client) {
      client.once('connect', function () {
        assert.that(function () {
          client.send(undefined);
        }).is.throwing();
        done();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 500);
    }).end();
  });

  test('throws an error if data is null.', function (done) {
    app.post('/', route(function (client) {
      client.once('connect', function () {
        assert.that(function () {
          client.send(null);
        }).is.throwing();
        done();
      });
    }));

    http.request({
      method: 'POST',
      hostname: 'localhost',
      port: port,
      path: '/'
    }, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 500);
    }).end();
  });
});
