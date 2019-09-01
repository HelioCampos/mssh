const config = require('./config');
const os = require('os');
const hostname = os.hostname();
const pid = process.pid;
const name = require('../package').name;
const safeJsonStringify = require('safe-json-stringify');

const TRACE = 10;
const DEBUG = 20;
const INFO = 30;
const WARN = 40;
const ERROR = 50;
const FATAL = 60;

const colors = {
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  white: [37, 39],
  grey: [90, 39],
  black: [30, 39],
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39]
};

const esc = String.fromCharCode(0o33) + '[';

const stylizeWithColor = (str, color) => {
  if (!str) {
    return '';
  }
  const codes = colors[color];
  if (codes) {
    return `${esc}${codes[0]}m${str}${esc}${codes[1]}m`;
  }
  return str;
};

const levelFromName = {
  trace: TRACE,
  debug: DEBUG,
  info: INFO,
  warn: WARN,
  error: ERROR,
  fatal: FATAL
};
const nameFromLevel = Object.keys(levelFromName).reduce(
  (nameFromLevel, name) => {
    nameFromLevel[levelFromName[name]] = name;
    return nameFromLevel;
  },
  {}
);

const colorFromLevel = {
  [TRACE]: 'white', // TRACE
  [DEBUG]: 'yellow', // DEBUG
  [INFO]: 'cyan', // INFO
  [WARN]: 'magenta', // WARN
  [ERROR]: 'red', // ERROR
  [FATAL]: 'inverse' // FATAL
};

const firstStringIndex = (arr) => {
  const l = arr.length;
  for (let i = 0; i < l; i++) {
    if (typeof arr[i] === 'string') {
      return i;
    }
  }
  return -1;
};

const getDefaultLogLevel = (config, defaultLevel) => {
  const configLevel = Object.keys(levelFromName).reduce((l, levelName) => {
    if (config[levelName]) {
      if (!l) {
        return levelFromName[levelName];
      }
      if (levelFromName[levelName] < l) {
        return levelFromName[levelName];
      }
    }
    return l;
  }, undefined);
  return configLevel || defaultLevel;
};

const {
  json: defaultJson = true,
  pretty: defaultPretty = false,
  logLevel: defaultLogLevel = getDefaultLogLevel(config, 30),
  stackTrace: defaultStackTrace = false
} = config;

class Logger {
  constructor(options = {}) {
    const {
      json = defaultJson,
      pretty = defaultPretty,
      logLevel = defaultLogLevel,
      stackTrace = defaultStackTrace
    } = options;

    this.options = {
      json,
      pretty,
      logLevel,
      stackTrace
    };
  }

  levelFromName(name) {
    return levelFromName[name.toLowerCase()] || -1;
  }

  nameFromLevel(level) {
    const levels = Object.keys(nameFromLevel).map((level) => ({
      name: nameFromLevel[level],
      level: +level
    }));
    return levels.reduce((curr, item) => {
      if (item.level <= level) {
        return item.name;
      }
      return curr;
    }, 'trace');
  }

  error(...args) {
    const err = args[args.length - 1] instanceof Error ? args.pop() : null;
    if (err) {
      return this.log('error', err.toString(), ...args, err.stack);
    }
    return this.log('error', ...args);
  }

  log(level, ...args) {
    if (!levelFromName[level]) {
      args.unshift(level);
      level = 'info';
    }
    const logLevel = levelFromName[level];
    if (logLevel < this.options.logLevel) {
      return;
    }
    const options = this.options;
    const msgIndex = firstStringIndex(args);
    const msg = msgIndex > -1 ? args.splice(msgIndex, 1).join() : '';
    const pkt = {
      name,
      hostname,
      pid,
      time: new Date(),
      level: logLevel,
      levelName: level,
      msg,
      data: args,
      v: 0,
      trace: options.stackTrace
        ? new Error().stack
            .split('\n')
            .slice(3)
            .map((s) => '  ' + s.trim())
            .join('\n')
        : undefined
    };
    if (options.json) {
      return console.log(
        safeJsonStringify(pkt, null, options.pretty ? 2 : null)
      );
    }
    const stylize = options.pretty ? stylizeWithColor : (s) => s;
    const levelColor = colorFromLevel[pkt.level] || 'none';
    const logMsg = `${stylize(
      pkt.levelName.toUpperCase(),
      levelColor
    )} (${stylize(pkt.level, levelColor)}) ${stylize(
      pkt.time.toISOString(),
      'none'
    )}:`;
    console.log(logMsg, pkt.msg, ...pkt.data);
    if (pkt.trace) {
      console.log(pkt.trace);
    }
  }
}

Object.keys(levelFromName).forEach((name) => {
  Logger.prototype[name] =
    Logger.prototype[name] ||
    function(...args) {
      return this.log(name, ...args);
    };
});

const logger = new Logger();

module.exports = logger;
