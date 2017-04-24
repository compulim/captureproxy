'use strict';

const config      = require('./config');
const filterMap   = require('./lib/filterMap');
const fs          = require('fs');
const http        = require('http');
const number      = require('./lib/number');
const path        = require('path');
const { Semaphore } = require('./lib/semaphore');
const url         = require('url');

const agentKeepAlive       = new (require('agentkeepalive'))();
const PROXY_HEADER_PATTERN = /^proxy-/i;

class Session extends Semaphore {
  constructor(req, res) {
    super();

    const method = req.method;

    this._debug = require('debug')(`session#${ Math.random().toString(36).substr(2, 5) }`);

    this._debug(`New session for ${req.url}`);

    this.req = req;
    this.res = res;

    const parsedUrl = url.parse(req.url);
    const currentConfig = config();
    const proxyConfig = currentConfig.proxy;

    this._httpOptions = {
      hostname: (proxyConfig || parsedUrl).hostname,
      port    : (proxyConfig || parsedUrl).port || 80,
      path    : proxyConfig ? req.url : parsedUrl.path,
      method  : method,
      headers : filterMap(req.headers, (result, value, name) => !PROXY_HEADER_PATTERN.test(name)),
      agent   : false // agentKeepAlive
    };

    if (proxyConfig) {
      this._httpOptions.headers.host = parsedUrl.hostname + ':' + (parsedUrl.port || 80);
    }

    this
      .when('requestbodyready', this.handleRequestBodyReady.bind(this))
      .when('firstrequest'    , this.handleWhenFirstRequest.bind(this))
      .when('finalrequest'    , this.handleWhenFinalRequest.bind(this))
      .when('error'           , this.handleWhenError.bind(this));

    if (method === 'GET') {
      this.flag('requestbodyready', null);
    } else {
      this._debug(`Reading request body`);

      readAll(req, (err, body) => {
        if (err) {
          this.flag('error', err);
        } else {
          this._debug(`Got request body of ${body.length} bytes`)
          this.flag('requestbodyready', body);
        }
      });

      req.resume();
    }
  }

  handleRequestBodyReady(body) {
    http.request(this._httpOptions, cres => {
      this.flag('firstrequest', cres, body);
    }).on('error', err => {
      this.flag('error', err);
    }).end(body);
  };

  handleWhenFirstRequest(cres, body) {
    const proxyConfig = config().proxy;

    if (proxyConfig && cres.statusCode === 407 && cres.headers['proxy-authenticate']) {
      this._debug(`Sending request via upstream proxy`);

      var options = this._httpOptions;

      options.headers['proxy-authorization'] = 'BASIC ' + toBase64(proxyConfig.username + ':' + proxyConfig.password);

      http.request(options, cres => {
        this.flag('finalrequest', cres);
      }).on('error', err => {
        this.flag('error', err);
      }).end(body);
    } else {
      this.flag('finalrequest', cres);
    }
  };

  handleWhenFinalRequest(cres) {
    const { req, res }    = this;
    let   pattern         = config().capturePattern;
    const urlWithoutQuery = req.url.split('?')[0];
    const basename        = url.parse(urlWithoutQuery).path.split('/').pop();
    const filename        = path.resolve(config().capturePath || '', basename);
    const lastReport      = Date.now();
    let   numBytes        = 0;
    let   writeStream;

    pattern = pattern && new RegExp(pattern);

    this._debug(`Sending header ${ cres.statusCode } to browser ${ JSON.stringify(cres.headers) }`);

    res.writeHead(
      cres.statusCode,
      filterMap(cres.headers, name => !PROXY_HEADER_PATTERN.test(name))
    );

    cres.pause();

    if (cres.statusCode === 200 && pattern && pattern.test(urlWithoutQuery)) {
      this._debug(`Creating filestream for capture at ${ filename }`);

      try {
        writeStream = fs.createWriteStream(filename);
      } catch (err) {
        this._debug(`Failed to write to file ${ filename } due to ${ err }`);
        res.status(500).end();
        cres.close();
      }

      const contentLength = cres.headers['content-length'];

      this._debug('Start capturing to ' + basename + (contentLength ? ' (' + number.bytes(contentLength) + ')' : ''));
    }

    cres.on('data', data => {
      this._debug(`Got ${ data.length } bytes`);

      res.write(data);

      if (writeStream) {
        const now = Date.now();

        writeStream.write(data);

        if (now - lastReport > 1000) {
          this._debug(`Capturing to ${ basename } (${ number.bytes(numBytes + data.length) } downloaded)`);
          lastReport = now;
        }
      }

      numBytes += data.length;
    }).on('end', () => {
      res.end();

      this._debug(`Response body finished`);

      if (writeStream) {
        this._debug(`Closing write filestream`);
        writeStream.close();
        this._debug(`Captured to ${ basename } (${ number.bytes(numBytes) })`);
      }

      this.flag('completed');
      this._debug(`Completed ${ req.method } ${ req.url }`);
    }).on('close', err => {
      this.flag('error', err);

      this._debug(`Response body aborted`);

      if (writeStream) {
        this._debug(`Aborted during capture to ${ basename }`);

        writeStream.close();

        setTimeout(() => {
          fs.unlink(filename);
        }, 5000);
      }
    }).resume();
  };

  handleWhenError(err) {
    const { req, res } = this;

    this._debug(`Request ${ req.method } ${ req.url } failed`, { err: err });
    res.writeHead(502);
    res.end(err.message);
  };
}

function toBase64(str) {
  return new Buffer(str).toString('base64');
}

function readAll(stream, callback) {
  var buffers = [],
    count = 0;

  stream.on('data', chunk => {
    buffers.push(chunk);
    count += chunk.length;
  }).on('end', () => {
    callback(null, Buffer.concat(buffers, count));
    buffers = 0;
  }).on('close', err => {
    callback(err);
  });
}

module.exports = Session;
