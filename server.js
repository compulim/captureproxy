!function (ConnectSession, net, Session, url, winston) {
    'use strict';

    const debug = require('debug')('server');

    var app = require('http').createServer(),
        port = require('./config')().port || process.env.port || process.argv[2] || 5865;

    app.on('request', function (req, res) {
        debug('Got a new request');
        new Session(req, res);
    }).on('connect', function (req, socket, head) {
        debug('Got a HTTPS CONNECT request');
        new ConnectSession(req, socket, head);
    }).listen(port, function () {
        winston.info('Proxy started and listening to port ' + port);
    });

    winston.remove(winston.transports.Console);

    winston.add(winston.transports.Console, {
        colorize: true,
        level: require('./config')().logLevel || 'info'
    });

    var webrootPath = process.env.webroot_path;

    webrootPath && winston.add(winston.transports.File, {
        filename: require('path').resolve(webrootPath, '../../LogFiles/site/winston.log'),
        maxFiles: 5,
        maxsize: 1048576,
        level: 'info'
    });
}(
    require('./connectsession').ConnectSession,
    require('net'),
    require('./session').Session,
    require('url'),
    require('winston')
);