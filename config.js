!function (crypto, fs, winston) {
    'use strict';

    var CONFIG_FILENAME = 'config.json',
        RELOAD_INTERVAL = 10000,
        currentHash,
        instance,
        _reloadTimeout;

    module.exports = function () {
        if (!instance) {
            reloadConfigSync();
            scheduleReloadConfig();
        }

        return instance;
    };

    function scheduleReloadConfig() {
        clearTimeout(_reloadTimeout);

        _reloadTimeout = setTimeout(function () {
            reloadConfig(function (err) {
                scheduleReloadConfig();
            });
        }, RELOAD_INTERVAL);
    }

    function reloadConfig(callback) {
        readJsonFile(CONFIG_FILENAME, function (err, json) {
            if (!err) {
                var newHash = hash(json);

                if (currentHash !== newHash) {
                    winston.info('Config updated');
                    instance = json;
                    currentHash = newHash
                }
            }

            callback(err);
        });
    }

    function readJsonFile(filename, callback) {
        fs.readFile(filename, function (err, data) {
            if (!err) {
                try {
                    data = JSON.parse(data);
                } catch (ex) {
                    err = ex;
                }
            }

            callback(err, err ? null : data);
        });
    }

    function reloadConfigSync() {
        var json = readJsonFileSync(CONFIG_FILENAME),
            newHash = hash(json);

        if (currentHash !== newHash) {
            winston.info('Config updated');
            instance = json;
            currentHash = newHash;
        }
    }

    function readJsonFileSync(filename) {
        return JSON.parse(fs.readFileSync(filename));
    }

    function hash(json) {
        var hash = crypto.createHash('sha1');

        hash.update(new Buffer(JSON.stringify(json)));

        return hash.digest('base64');
    }
}(
    require('crypto'),
    require('fs'),
    require('winston')
);