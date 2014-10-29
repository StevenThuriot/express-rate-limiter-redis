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

var Store = require('express-rate-limiter/store');
RedisStore.prototype = Object.create(Store.prototype);

RedisStore.prototype.get = function (key, callback) {
    this.__client.get(key, function (err, data) {
        if (err) {
            callback(err, undefined);
        } else {
            var result;

            if (data) {
                result = JSON.parse(data);
            }

            callback(err, data);
        }
    });
};

RedisStore.prototype.create = function (key, value, lifetime, callback) {
    var multi = this.__client.multi();

    multi.set(key, JSON.stringify(value))
        .expire(key, lifetime);

    multi.exec(function (err, data) {
        callback(err, value);
    });
};


RedisStore.prototype.update = function (key, value, callback) {
    this.__client.set(key, JSON.stringify(value), function (err, data) {
        callback(err, value);
    });
};