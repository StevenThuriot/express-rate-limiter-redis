[![Express Rate Limiter - Redis](http://img.dafont.com/preview.php?text=Express+Rate+Limiter+Redis&ttf=squared_display0&ext=1&size=64&psize=m&y=53)](https://github.com/StevenThuriot/express-rate-limiter-redis)
====================

[![npm](https://img.shields.io/npm/v/express-rate-limiter-redis.svg?style=flat-square)](https://www.npmjs.org/package/express-rate-limiter-redis)[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](https://www.npmjs.org/package/express-rate-limiter-redis)

Rate limiter middleware for express applications, using a redis store as back-end.

This limiter has two kinds of limits: an inner and outer limit. It limites based on user ip.

The inner limit is against hammering (e.g. only 3 calls allowed per second). The outer limit is for protecting against over-use. (e.g. max 60 times per two minutes).

# Usage

Install

```
npm install express-rate-limiter-redis --save
```

First, create a new Limiter;

```javascript
var Limiter = require('express-rate-limiter-redis/limiter'), //For easy usage, this redirects to express-rate-limiter (The main module)
    RedisStore = require('express-rate-limiter-redis'),
    store = new RedisStore(),
    limiter = new Limiter({ db : store });
```

The `RedisStore` defaults to `127.0.0.1` as host and `6379` as port. These can be overwritten by passing them to the ctor, like so:

```javascript
var store = new RedisStore({
    host: '127.0.0.1',
    port: 6379
});
```

Or when you have a url:

```javascript
var store = new RedisStore({
    url: 'redis://127.0.0.1:6379'
});
```

In case the url contains auth data, the client will automatically authenticate.

Instead of passing along options, it is also possible to pass a different redis store (or mock) with the same signature:

```javascript
var redis = require("redis"),
        client = redis.createClient();

var store = new RedisStore({
    client: client
});
```

Options different than the ones above, will be used to pass to the redisClient when created internally.

Afterwards, use the limiter to create an express middleware for the express methods you want to rate limit.

```javascript
app.post('/', limiter.middleware(), function(req, res) {   

});
```

Anything written in the callback will now be rate limited.

Since the connection to the redis server causes an asynchronous overhead, it is recommended to increase the inner expiration time. Leaving it on it's default, `3 seconds`, will result in possible race conditions that can't be avoided. This can be configured as follows:

```javascript
    var limiter = new Limiter({
        db: redisStore,
        innerTimeLimit: 10000,
        innerLimit: 15
    });
```


# More info
For more info, see [expres-rate-limiter](https://github.com/StevenThuriot/express-rate-limiter).
