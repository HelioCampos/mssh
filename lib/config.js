require('dotenv').config();
const minimist = require('minimist');
const fs = require('fs');
const path = require('path');

const margv = minimist(process.argv.slice(2));
const env = process.env;

const isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n);
const isFalse = (s) => (s ? /^(n|no|f|false|0)$/i.exec(s.toString()) : true);
const isTrue = (s) => s && /^(y|yes|t|true|1)$/i.exec(s.toString());

const typedValue = (s) => {
  if (!s) {
    return s;
  }
  if (isNumeric(s)) {
    return +s;
  }
  if (isTrue(s)) {
    return true;
  }
  if (isFalse(s)) {
    return false;
  }
  return s;
};

const argv = Object.keys(margv).reduce((argv, key) => {
  const value = typedValue(margv[key]);
  argv[key] = value;
  return argv;
}, {});

const trueType = (o) => {
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

const unique = (a) =>
  a.filter((e, i, arr) => {
    return arr.findIndex((item) => isTheSame(e, item)) === i;
  });

const merge = (source, ...args) => {
  const sourceType = trueType(source);
  return args.reduce((merged, arg) => {
    const argType = trueType(arg);
    if (argType !== sourceType) {
      if (typeof arg === 'undefined') {
        return merged;
      }
      if (typeof merged === 'undefined') {
        return arg;
      }
      return arg;
    }
    if (sourceType === 'object') {
      //return Object.assign({}, arg, source);
      return Object.keys(arg).reduce((o, key) => {
        o[key] = merge(o[key], arg[key]);
        return o;
      }, Object.assign({}, source));
    }
    return arg;
  }, source);
};

const setObjectValue = (source, key = '', value) => {
  try {
    let o = source;
    let last, segment;
    const path = Array.isArray(key) ? key : key.split('.');
    while (o && path.length) {
      segment = path.shift();
      last = o;
      o = o[segment];
      if (!o) {
        o = last[segment] = {};
      }
    }
    last[segment] = value;
    return source;
  } catch (e) {
    require('./logger').error(e.toString(), key, value, source, e);
    throw e;
  }
};

const camelCase = (s) =>
  s.toLowerCase().replace(/_([a-z0-9])/gi, (_, l) => l.toUpperCase());

const envToObj = (env) => {
  return Object.keys(env).reduce((obj, key) => {
    const path = key.split('__').map(camelCase);
    return setObjectValue(obj, path, typedValue(env[key]));
  }, {});
};

const getConfig = () => {
  const { configfile } = argv;
  if (configfile) {
    const config = require(path.resolve('./', configfile));
    return Object.assign({}, config, argv);
  }
  return merge(argv, envToObj(env));
};

const config = getConfig();

const secrets = (() => {
  try {
    const secretsLocation = config.secretsPath || '/run/secrets/';
    const paths = fs
      .readdirSync(secretsLocation)
      .filter((d) => ['.', '..'].indexOf(d) === -1);
    return paths.reduce((secrets, key) => {
      try {
        const secret = fs
          .readFileSync(path.resolve(secretsLocation, key))
          .toString();
        secrets[key] = typedValue(secret);
      } catch (e) {
        require('./logger').error(e);
      }
      return secrets;
    }, {});
  } catch (e) {
    return {};
  }
})();

module.exports = merge(config, secrets);
