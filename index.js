'use strict';

const ConnectSession = require('./connectsession');
const debug          = require('debug')('server');
const net            = require('net');
const Session        = require('./session');
const url            = require('url');

function main() {
  const app  = require('http').createServer();
  const port = require('./config')().port || process.env.port || process.argv[2] || 5865;

  app.on('request', (req, res) => {
    debug('Got a new request');
    new Session(req, res);
  }).on('connect', (req, socket, head) => {
    debug('Got a HTTPS CONNECT request');
    new ConnectSession(req, socket, head);
  }).listen(port, () => {
    debug('Proxy started and listening to port ' + port);
  });
}

main();
