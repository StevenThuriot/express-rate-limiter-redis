var RedisStore = module.exports = function (options) {
    if (configuration.client) {
        this.__client = configuration.client;
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

            if (key != 'host' && key != 'port') {
                redisOptions[key] = configuration[key];
            }
        }

        var Redis = require('redis');

        this.__client = Redis.createClient(configuration.host, configuration.port, redisOptions);
    }

    this.__client.on("error", function (err) {
        console.log("redis error event - " + client.host + ":" + client.port + " - " + err);
    });

}

var Store = require('express-rate-limiter/lib/store');
RedisStore.prototype = Object.create(Store.prototype);

RedisStore.prototype.get = function (key, callback) {
    var multi = this.__client.multi();

    multi.get(key)
         .get(key + "_outer")
         .get(key + "_inner");

    multi.exec(function (err, replies) {
        if (err) {
            callback(err, undefined);
        } else {
            var result;

            if (replies) {
                result = JSON.parse(replies[0]);
                //Due to race conditions, these are more reliable than the ones on the JSON string.
                result.outer = replies[1];
                result.inner = replies[2]; 
            }

            callback(err, result);
        }
    });
};

RedisStore.prototype.create = function (key, value, lifetime, callback) {
    var multi = this.__client.multi();

    multi.set(key, JSON.stringify(value))
        .set(key + "_outer", value.outer)
        .set(key + "_inner", value.inner)
        .expire(key, lifetime);

    multi.exec(function (err, data) {
        callback(err, value);
    });
};

MemoryStore.prototype.decreaseLimits = function (ip, value, resetInner, configuration, callback) {
    var multi = this.__client.multi();

    multi.set(key, JSON.stringify(value))
         .decr(key + "_outer");

    if (resetInner === true) {
        multi.set(key + "_inner", configuration.innerLimit);
    } else {
        multi.decr(key + "_inner");
    }

    multi.exec(function (err, data) {
        if (!err && data) {
            value.outer = data[1];
            value.inner = data[2];
        }

        callback(err, value);
    });
};