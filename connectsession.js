'use strict';

const agentKeepAlive     = new (require('agentkeepalive'))();
const config             = require('./config');
const filterMap          = require('./lib/filterMap');
const http               = require('http');
const net                = require('net');
const url                = require('url');
const { Semaphore }      = require('./lib/semaphore');

const PROXY_HEADER_PATTERN = /^proxy-/;

class ConnectSession extends Semaphore {
  constructor(req, socket, head) {
    super();

    this._debug = require('debug')(`session#${ Math.random().toString(36).substr(2, 5) }`);
    this._socket = socket;

    this.when('connect', this.handleWhenConnect.bind(this));
    this.when('error', this.handleWhenError.bind(this));

    const target = req.url;
    const proxyConfig = config().proxy;

    if (proxyConfig) {
      const headers = filterMap(headers, (value, name) => !PROXY_HEADER_PATTERN.test(name));

      if (proxyConfig.username && proxyConfig.password) {
        headers['proxy-authorization'] = 'BASIC ' + toBase64(proxyConfig.username + ':' + proxyConfig.password);
      }

      http.request({
        agent   : false,
        headers : headers,
        hostname: proxyConfig.hostname,
        method  : 'CONNECT',
        path    : target,
        port    : proxyConfig.port
      }).on('connect', (res, clientSocket, clientHead) => {
        if (res.statusCode === 200) {
          this._debug('CONNECT-ed to ' + target + ' via proxy');

          this.flag('connect', clientSocket, socket);

          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          socket.write(clientHead);

          clientSocket.write(head);
        } else {
          this._debug('Failed to CONNECT to ' + target + ' via proxy, server returned ' + res.statusCode);
          socket.destroy();
        }
      }).on('error', err => {
        this._debug('Failed to CONNECT to ' + target + ' via proxy', { err: err });
        socket.destroy();
      }).end();
    } else {
      const endPoint = url.parse('tcp:' + target);
      const clientSocket = net.connect(endPoint.port, endPoint.hostname);

      clientSocket.on('connect', () => {
        this._debug('CONNECT-ed to ' + target);

        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        this.flag('connect', clientSocket, socket);
      }).on('error', err => {
        this._debug('Failed to CONNECT to ' + target, { err: err });
        socket.destroy();
      });
    }
  }

  handleWhenConnect(s1, s2) {
    s1.on('data', chunk => {
      s2.write(chunk);
    }).on('end', () => {
      s2.end();
    }).on('error', err => {
      s2.destroy();
    });

    s2.on('data', chunk => {
      s1.write(chunk);
    }).on('end', () => {
      s1.end();
    }).on('error', err => {
      s1.destroy();
    });
  }

  handleWhenError() {
    this._socket.destroy();
  }
}

module.exports = ConnectSession;

function toBase64(str) {
  return new Buffer(str).toString('base64');
}
