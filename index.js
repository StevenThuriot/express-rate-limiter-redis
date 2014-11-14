var RedisStore = module.exports = function (options) {
    if (options.client) {
        this.__client = options.client;
    } else {

        var configuration = {
            port: 6379,
            host: '127.0.0.1'
        };

        var redisOptions = {};

        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                configuration[key] = options[key];
            }

            if (key != 'host' && key != 'port' && key != 'url') {
                redisOptions[key] = configuration[key];
            }
        }

        var Redis = require('redis');

        if (configuration.url) {
            var redisURL = require('url').parse(configuration.url);

            this.__client = Redis.createClient(redisURL.port, redisURL.hostname, redisOptions);

            if (redisURL.auth) {
                this.__client.auth(redisURL.auth.split(":")[1]);
            }

        } else {
            this.__client = Redis.createClient(configuration.port, configuration.host, redisOptions);
        }


    }

    var client = this.__client;
    client.on("error", function (err) {
        console.log("redis error event - " + client.host + ":" + client.port + " - " + err);
    });

}

var Store = require('express-rate-limiter/lib/store');
RedisStore.prototype = Object.create(Store.prototype);

RedisStore.prototype.auth = function (value) {
    this.__client.auth(value);
};

RedisStore.prototype.get = function (key, callback, configuration) {
    var multi = this.__client.multi();

    this.__client.ttl(key, function (err, ttl) {

        if (err) {
            callback(err, undefined);
            return;
        }

        if (ttl == 0 || ttl == -1) {
            multi.del(key)
                .del(key + "_outer")
                .del(key + "_inner");

            multi.exec(function (err) {
                callback(err, undefined);
            });

            return;
        }

        multi.get(key)
            .get(key + "_outer")
            .get(key + "_inner");

        multi.exec(function (err, replies) {
            if (err) {
                callback(err, undefined);
            } else {
                var result;

                if (replies) {
                    var jsonString = replies[0];

                    if (jsonString) {
                        result = JSON.parse(jsonString);
                        //Due to race conditions, these are more reliable than the ones on the JSON string.
                        result.outer = replies[1] || configuration.outerLimit;
                        result.inner = replies[2] || configuration.innerLimit;
                    }
                }

                callback(err, result);
            }
        });
    });
};

RedisStore.prototype.create = function (key, value, configuration, callback) {
    var client = this.__client;
    var multi = client.multi();

    multi.set(key, JSON.stringify(value))
        .set(key + "_outer", value.outer)
        .set(key + "_inner", value.inner);

    multi.exec(function (err) {
        if (err) {
            callback(err, value);
        } else {
            var multi2 = client.multi();

            var expiration = Math.round(configuration.outerTimeLimit / 1000);
            var innerExpiration = Math.round(configuration.innerTimeLimit / 1000);

            multi2.expire(key, expiration)
                .expire(key + "_outer", expiration);

            multi2.exec(function (err2) {
                callback(err2, value);
            });
        }
    });
};

RedisStore.prototype.decreaseLimits = function (key, value, resetInner, configuration, callback) {
    var client = this.__client;
    var multi = client.multi();

    multi.set(key, JSON.stringify(value))
        .decr(key + "_outer");

    if (resetInner === true) {
        multi.set(key + "_inner", configuration.innerLimit);
    } else {
        multi.decr(key + "_inner");
    }

    multi.exec(function (err, data) {
        if (!err && data) {
            var outerLimit = +data[1];
            value.outer = outerLimit;

            if (resetInner === true) {
                value.inner = configuration.innerLimit;
            } else {
                var innerLimit = +data[2];
                value.inner = innerLimit;
            }

            var expiration = Math.round((value.firstDate + configuration.outerTimeLimit - Date.now()) / 1000);
            var innerExpiration = Math.round(configuration.innerTimeLimit / 1000);

            var multi2 = client.multi();
            multi2.expire(key, expiration)
                  .expire(key + "_outer", expiration);

            multi2.exec(function (err2) {
                callback(err2, value);
            });
        } else {
            callback(err, value);
        }
    });
};