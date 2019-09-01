const logger = require('./logger');
const Express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const EventEmitter = require('events');
const os = require('os');
const crypto = require('crypto');
const pjson = require('../package.json');
const net = require('net');

const isAvailable = options =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(options, () => {
      const { port } = server.address();
      server.close(() => {
        resolve(port);
      });
    });
  });

const getPort = options => {
  options = Object.assign({}, options);

  if (typeof options.port === 'number') {
    options.port = [options.port];
  }

  return (options.port || []).reduce(
    (seq, port) =>
      seq.catch(() => isAvailable(Object.assign({}, options, { port }))),
    Promise.reject()
  );
};

const { psk: rawPSK = false } = config;
const PSK = (rawPSK || '').trim();

const byteToHex = (() => {
  const byteToHex = new Array(256);
  for (let i = 0; i < 256; ++i) {
    byteToHex[i] = (i + 0x100).toString(16).substr(1);
  }
  return byteToHex;
})();

const bytesToUuid = (buf, offset) => {
  let i = offset || 0;
  return [
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    '-',
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    '-',
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    '-',
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    '-',
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    byteToHex[buf[i++]],
    byteToHex[buf[i++]]
  ].join('');
};

const ID = () => {
  let i = 0;
  let rnds = crypto.randomBytes(16);
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;
  return bytesToUuid(rnds);
};

const conversationId = (req, res, next) => {
  req.conversationId = ID();
  res.set({ 'Conversation-ID': req.conversationId });
  return next();
};

const requestLogger = (req, res, next) => {
  const { conversationId, method, path, query, headers } = req;
  logger.trace('Incoming:', {
    method,
    conversationId,
    path,
    query,
    headers
  });
  const prevWriteHead = res.writeHead.bind(res);

  res.writeHead = (...args) => {
    logger.trace('Incoming complete:', {
      method,
      conversationId,
      path,
      query
    });
    return prevWriteHead(...args);
  };
  return next();
};

const pskAuth = PSK
  ? (req, res, next) => {
      const key =
        req.headers['x-psk'] || req.headers.psk || req.query.psk || '';
      if (key !== PSK) {
        logger.error('Invalid request, no PSK', req.method, req.path);
        return res.sendStatus(401);
      }
      return next();
    }
  : (req, res, next) => next();

const initApp = ({ addHealthRoute = true } = {}) => {
  const app = Express();
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(conversationId);
  app.use(requestLogger);
  app.use(pskAuth);
  app.use(Express.static('public'));

  if (addHealthRoute) {
    app.get('/health', (req, res) => {
      return res.send({
        status: 'running',
        pid: process.pid,
        version: pjson.version,
        os: {
          hostname: os.hostname(),
          loadavg: os.loadavg(),
          uptime: os.uptime(),
          freemem: os.freemem(),
          totalmem: os.totalmem(),
          memoryUsage: process.memoryUsage(),
          cpus: os.cpus(),
          type: os.type(),
          release: os.release(),
          arch: os.arch(),
          platform: os.platform()
        }
      });
    });
  }
  return app;
};

const trueType = o => {
  const type = typeof o;
  if (type === 'object') {
    if (Array.isArray(o)) {
      return 'array';
    }
    if (o instanceof RegExp) {
      return 'regex';
    }
    if (o instanceof Date) {
      return 'date';
    }
    if (o === null) {
      return 'null';
    }
    return type;
  }
  return type;
};

const filterTest = (a, b) => {
  const typeA = trueType(a);
  const typeB = trueType(b);
  if (typeB === 'function') {
    return b(a);
  }
  if (typeB === 'regex') {
    return b.exec(a);
  }
  if (typeA === 'array') {
    if (a.length === 0) {
      return false;
    }
    return a.findIndex(i => filterTest(i, b)) > -1;
  }
  if (typeA !== typeB) {
    return false;
  }
  if (typeA === 'object') {
    const keys = Object.keys(a);
    return keys.every(key => {
      const test = a[key];
      const val = b[key];
      if (typeof val === 'undefined') {
        return false;
      }
      return filterTest(val, test);
    });
  }
  return a === b;
};

const makeFilter = source => {
  const sourceType = trueType(source);
  switch (sourceType) {
    case 'string':
      return new RegExp(source, 'i');
    case 'object':
      return Object.keys(source).reduce((o, k) => {
        o[k] = makeFilter(source[k]);
        return o;
      }, {});
    case 'array':
      return source.map(makeFilter);
  }
  return source;
};

const getBasicAuthorization = req => {
  return req.headers.Authorization || req.headers.authorization;
};

const CREDENTIALS_REGEXP = /^ *(?:basic) +([a-z0-9._~+/-]+=*) *$/i;
const USER_PASS_REGEXP = /^([^:]*):(.*)$/;

const parseBasicAuth = header => {
  const match = CREDENTIALS_REGEXP.exec(string);
  if (!match) {
    return {};
  }
  const userPass = USER_PASS_REGEXP.exec(decodeBase64(match[1]));
  if (!userPass) {
    return {};
  }
  return {
    name: userPass[1],
    pass: userPass[2]
  };
};

class Server {
  constructor(options = {}) {
    const { port = config.port, host = config.host || 'localhost' } = options;
    this.port = port;
    this.host = host;
    this.app = initApp(options);
    this.emitter = new EventEmitter();
  }

  on(...args) {
    return this.emitter.on(...args);
  }

  all(...args) {
    return this.app.all(...args);
  }

  get(...args) {
    return this.app.get(...args);
  }

  post(...args) {
    return this.app.post(...args);
  }

  put(...args) {
    return this.app.put(...args);
  }

  delete(...args) {
    return this.app.delete(...args);
  }

  route(...args) {
    return this.app.route(...args);
  }

  param(...args) {
    return this.app.param(...args);
  }

  set(...args) {
    return this.app.set(...args);
  }

  use(...args) {
    return this.app.use(...args);
  }

  sendError(res, err) {
    err.statusCode = err.statusCode || 400;
    err.errmsg = err.errmsg || err.toString();
    err.name = err.name || 'Error';
    logger.error(err);
    return res.status(err.statusCode).send(err);
  }

  sendTable(res, list) {
    const keys = Object.keys(list[0]);
    const head = '<tr><th>' + keys.join('</th><th>') + '</th></tr>';
    const rows = list
      .map(
        row =>
          '<tr><td>' +
          keys.map(key => row[key]).join('</td><td>') +
          '</td></tr>'
      )
      .join('\n');
    return res.send(`<html>
  <head>
  </head>
  <body>
    <table border="1">
      ${head}
      ${rows}
    </table>
  </body>
</html>`);
  }

  static basicAuth(req) {
    if (!req) {
      throw new TypeError('Missing required parameter req');
    }
    const header = getBasicAuthorization(req);
    return header ? parseBasicAuth(header) : {};
  }

  static filterArray(filter, data) {
    filter = makeFilter(filter);
    return data.filter(item => filterTest(filter, item));
  }

  async start() {
    const preferredPorts = new Array(999)
      .fill(undefined)
      .map((p, i) => 3000 + i);
    const port =
      this.port || (await getPort({ port: [8080].concat(preferredPorts) }));
    const app = this.app;
    app.listen(port, this.host, () => {
      logger.info(`Listening on ${this.host || 'localhost'}:${port}!`);
      this.emitter.emit('ready', this);
    });
  }
}

module.exports = Server;
