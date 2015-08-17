!function (ConnectSession, net, Session, url, winston) {
    'use strict';

    var app = require('http').createServer(),
        port = require('./config').port || process.env.port || process.argv[2] || 5865;

    app.on('request', function (req, res) {
        new Session(req, res);
    }).on('connect', function (req, socket, head) {
        new ConnectSession(req, socket, head);
    }).listen(port, function () {
        winston.info('Proxy started and listening to port ' + port);
    });

    winston.remove(winston.transports.Console);

    winston.add(winston.transports.Console, {
        colorize: true,
        level: 'info'
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