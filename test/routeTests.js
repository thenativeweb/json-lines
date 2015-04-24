'use strict';

var http = require('http');

var assert = require('assertthat'),
    express = require('express'),
    Timer = require('timer2');

var route = require('../lib/route')(1.5);

suite('route', function () {
  var app,
      port = 3000;

  setup(function () {
    app = express();
    http.createServer(app).listen(++port);
  });

  teardown(function () {
    app = undefined;
  });

  test('is a function.', function (done) {
    assert.that(route).is.ofType('function');
    done();
  });

  test('emits an open event when the client connects.', function (done) {
    app.get('/', route(function (client) {
      client.once('open', function () {
        done();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    });
  });

  test('emits a close event when the client disconnects.', function (done) {
    app.get('/', route(function (client) {
      client.once('close', function () {
        done();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    });
  });

  test('is able to close a client.', function (done) {
    app.get('/', route(function (client) {
      client.once('open', function () {
        client.send({ foo: 'bar' });
        client.close();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      res.once('data', function (data) {
        assert.that(JSON.parse(data.toString())).is.equalTo({ foo: 'bar' });
      });

      res.once('end', function () {
        done();
      });
    });
  });

  test('emits a close event when the client is closed from the server.', function (done) {
    app.get('/', route(function (client) {
      client.once('open', function () {
        client.close();
      });

      client.once('close', function () {
        done();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 0.5 * 1000);
    });
  });

  test('cleans up when the client disconnects.', function (done) {
    app.get('/', route(function (client) {
      client.on('open', function () {
        // Intentionally left blank...
      });

      client.on('close', function () {
        process.nextTick(function () {
          assert.that(client.listeners('open').length).is.equalTo(0);
          assert.that(client.listeners('close').length).is.equalTo(0);
          done();
        });
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 500);
    });
  });

  test('sends heartbeats.', function (done) {
    var counter = 0;

    this.timeout(5 * 1000);

    app.get('/', route(function () {
      // Intentionally left blank ;-)
    }));

    http.get('http://localhost:' + port, function (res) {
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
    });
  });

  test('streams data.', function (done) {
    app.get('/', route(function (client) {
      var counter = 0,
          timer = new Timer(100);

      client.once('open', function () {
        timer.on('tick', function () {
          client.send({ counter: counter++ });
        });
      });

      client.once('close', function () {
        timer.destroy();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
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
    });
  });

  test('handles newlines in data gracefully.', function (done) {
    app.get('/', route(function (client) {
      client.once('open', function () {
        client.send({ text: 'foo\nbar' });
      });
    }));

    http.get('http://localhost:' + port, function (res) {
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
    });
  });

  test('throws an error if data is not an object.', function (done) {
    app.get('/', route(function (client) {
      client.once('open', function () {
        assert.that(function () {
          client.send(undefined);
        }).is.throwing();
        done();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 500);
    });
  });

  test('throws an error if data is null.', function (done) {
    app.get('/', route(function (client) {
      client.once('open', function () {
        assert.that(function () {
          client.send(null);
        }).is.throwing();
        done();
      });
    }));

    http.get('http://localhost:' + port, function (res) {
      setTimeout(function () {
        res.socket.end();
        res.removeAllListeners();
      }, 500);
    });
  });
});
