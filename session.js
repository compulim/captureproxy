!function (config, http, linq, Semaphore, url, winston, fs, path, number) {
    'use strict';

    var agentKeepAlive = new (require('agentkeepalive'))(),
        proxyHeaderPattern = /^proxy-/i;

    function Session(req, res) {
        var that = this,
            method = req.method;

        Semaphore.call(that);

        that.req = req;
        that.res = res;

        var parsedUrl = url.parse(req.url),
            currentConfig = config(),
            proxyConfig = currentConfig.proxy;

        that._httpOptions = {
            hostname: (proxyConfig || parsedUrl).hostname,
            port: (proxyConfig || parsedUrl).port || 80,
            path: proxyConfig ? req.url : parsedUrl.path,
            method: method,
            headers: linq(req.headers).where(function (name) {
                return !proxyHeaderPattern.test(name);
            }).run(),
            agent: false // agentKeepAlive
        };

        if (proxyConfig) {
            that._httpOptions.headers.host = parsedUrl.hostname + ':' + (parsedUrl.port || 80);
        }

        that.when('requestbodyready', that.requestbodyready.bind(that))
            .when('firstrequest', that.whenfirstrequest.bind(that))
            .when('finalrequest', that.whenfinalrequest.bind(that))
            .when('error', that.whenerror.bind(that));

        if (method === 'GET') {
            that.flag('requestbodyready', null);
        } else {
            readAll(req, function (err, body) {
                if (err) {
                    that.flag('error', err);
                } else {
                    that.flag('requestbodyready', body);
                }
            });

            req.resume();
        }
    }

    require('util').inherits(Session, Semaphore);

    Session.prototype.requestbodyready = function (body) {
        var that = this;

        http.request(that._httpOptions, function (cres) {
            that.flag('firstrequest', cres, body);
        }).on('error', function (err) {
            that.flag('error', err);
        }).end(body);
    };

    Session.prototype.whenfirstrequest = function (cres, body) {
        var that = this,
            proxyConfig = config().proxy;

        if (proxyConfig && cres.statusCode === 407 && cres.headers['proxy-authenticate']) {
            var options = that._httpOptions;

            options.headers['proxy-authorization'] = 'BASIC ' + toBase64(proxyConfig.username + ':' + proxyConfig.password);

            http.request(options, function (cres) {
                that.flag('finalrequest', cres);
            }).on('error', function (err) {
                that.flag('error', err);
            }).end(body);
        } else {
            that.flag('finalrequest', cres);
        }
    };

    Session.prototype.whenfinalrequest = function (cres) {
        var that = this,
            req = that.req,
            res = that.res,
            pattern = config().capturePattern,
            urlWithoutQuery = req.url.split('?')[0],
            basename = url.parse(urlWithoutQuery).path.split('/').pop(),
            filename = path.resolve(config().capturePath || '', basename),
            writeStream,
            lastReport = Date.now(),
            numBytes = 0;

        pattern = pattern && new RegExp(pattern);

        res.writeHead(
            cres.statusCode,
            linq(cres.headers).where(function (name) {
                return !proxyHeaderPattern.test(name);
            }).run()
        );

        cres.pause();

        if (cres.statusCode === 200 && pattern && pattern.test(urlWithoutQuery)) {
            try {
                writeStream = fs.createWriteStream(filename);
            } catch (err) {
                winston.error('Failed to write to file ' + filename + ' due to ' + err);
                res.status(500).end();
                cres.close();
            }

            var contentLength = cres.headers['content-length'];

            winston.info('Start capturing to ' + basename + (contentLength ? ' (' + number.bytes(contentLength) + ')' : ''));
        }

        cres.on('data', function (data) {
            res.write(data);

            if (writeStream) {
                var now = Date.now();

                writeStream.write(data);

                if (now - lastReport > 1000) {
                    winston.info('Capturing to ' + basename + ' (' + number.bytes(numBytes + data.length) + ' downloaded)');
                    lastReport = now;
                }
            }

            numBytes += data.length;
        }).on('end', function () {
            res.end();

            if (writeStream) {
                writeStream.close();
                winston.info('Captured to ' + basename + ' (' + number.bytes(numBytes) + ')');
            }

            that.flag('completed');
            winston.debug('Completed ' + req.method + ' ' + req.url);
        }).on('close', function (err) {
            that.flag('error', err);

            if (writeStream) {
                winston.warn('Aborted during capture to ' + basename);

                writeStream.close();

                setTimeout(function () {
                    fs.unlink(filename);
                }, 5000);
            }
        }).resume();
    };

    Session.prototype.whenerror = function (err) {
        var that = this,
            req = that.req,
            res = that.res;

        winston.info('Request ' + req.method + ' ' + req.url + ' failed', { err: err });
        res.writeHead(502);
        res.end(err.message);
    };

    function toBase64(str) {
        return new Buffer(str).toString('base64');
    }

    function readAll(stream, callback) {
        var buffers = [],
            count = 0;

        stream.on('data', function (chunk) {
            buffers.push(chunk);
            count += chunk.length;
        }).on('end', function () {
            callback(null, Buffer.concat(buffers, count));
            buffers = 0;
        }).on('close', function (err) {
            callback(err);
        });
    }

    module.exports.Session = Session;
}(
    require('./config'),
    require('http'),
    require('async-linq'),
    require('./lib/semaphore').Semaphore,
    require('url'),
    require('winston'),
    require('fs'),
    require('path'),
    require('./lib/number')
);