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

RedisStore.prototype.__arrayIsValid = function (arr) {
    if (!arr) return false;

    for (var i = 0; i < arr.length; i++) {
        var value = arr[i];
        if (value === undefined || value === null)
            return false;
    }

    return true;
}

RedisStore.prototype.get = function (key, callback) {
    var multi = this.__client.multi();

    multi.get(key)
        .get(key + "_outer")
        .get(key + "_inner");

    var self = this;
    multi.exec(function (err, replies) {
        if (err) {
            callback(err, undefined);
        } else {
            var result;

            if (self.__arrayIsValid(replies)) {
                result = JSON.parse(replies[0]);
                //Due to race conditions, these are more reliable than the ones on the JSON string.
                if (replies[1]) {
                    result.outer = replies[1];
                }
                if (replies[2]) {
                    result.inner = replies[2];
                }
            }

            callback(err, result);
        }
    });
};

RedisStore.prototype.create = function (key, value, lifetime, callback) {
    var multi = this.__client.multi();

    var expiration = lifetime / 1000;

    multi.set(key, JSON.stringify(value))
        .set(key + "_outer", value.outer)
        .set(key + "_inner", value.inner)
        .expire(key, expiration)
        .expire(key + "_outer", expiration)
        .expire(key + "_inner", expiration);

    multi.exec(function (err, data) {
        callback(err, value);
    });
};

RedisStore.prototype.decreaseLimits = function (key, value, resetInner, configuration, callback) {
    var multi = this.__client.multi();

    multi.set(key, JSON.stringify(value))
        .decr(key + "_outer");

    if (resetInner === true) {
        var expiration = configuration.outerTimeLimit / 1000;

        multi.set(key + "_inner", configuration.innerLimit)
             .expire(key + "_inner", expiration);
    } else {
        multi.decr(key + "_inner");
    }


    var self = this;
    multi.exec(function (err, data) {
        if (!err && self.__arrayIsValid(data)) {
            value.outer = data[1];

            if (resetInner === true) {
                value.inner = configuration.innerLimit;
            } else {
                value.inner = data[2];
            }
        }

        callback(err, value);
    });
};