//*
const logger = require('./lib/logger');
const config = require('./lib/config');
const Path = require('path');
const fs = require('fs');
const express = require('express');
const Server = require('./lib/server');
const { execute: exec } = require('./lib/runner');

const YAML = require('js-yaml');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const uploads = upload.fields([{ name: 'privateKeyFile', maxCount: 1 }]);

const Async = require('async');

const os = require('os');

const defaultPrivateKey = require('./lib/privatekey');
const defaultUsername = config.sshUsername || os.userInfo().username;
const defaultPassword = config.sshPassword;

const agent = config.sshAuthSock;

const server = new Server();

server.use('/', express.static(Path.join(__dirname, 'public/build')));

const isNumeric = n => !isNaN(parseFloat(n)) && isFinite(n);

const loadTextFile = filename => fs.readFileSync(filename).toString();

const loadYamlFile = filename => {
  const src = loadTextFile(filename);
  return YAML.safeLoad(src);
};

const loadJsonFile = filename => {
  const src = loadTextFile(filename);
  return JSON.parse(src);
};

const loadConfigFile = basename => {
  if (fs.existsSync(`./${basename}.yaml`)) {
    return loadYamlFile(`./${basename}.yaml`);
  }
  if (fs.existsSync(`./${basename}.yml`)) {
    return loadYamlFile(`./${basename}.yml`);
  }
  if (fs.existsSync(`./${basename}.json`)) {
    return loadJsonFile(`./${basename}.json`);
  }
  if (fs.existsSync(`./${basename}.js`)) {
    return require(`./${basename}.js`);
  }
  return {};
};

const loadAddressBook = () => loadConfigFile('addressbook');
const loadCookBook = () => loadConfigFile('recipes');

const addressbook = loadAddressBook();
const recipes = loadCookBook();

const loadFile = file => {
  const fn = Path.resolve(__dirname, file.path);
  return fs.readFileSync(fn).toString();
};

const getLimit = ({ limit }) => {
  if (isNumeric(limit)) {
    return +limit;
  }
};

const getCommands = ({ command, commands }) => {
  if (Array.isArray(commands)) {
    return commands;
  }
  if (command) {
    if (Array.isArray(command)) {
      return command;
    }
    return [command];
  }
  return [];
};

const getClients = ({ host, hosts }) => {
  if (hosts) {
    if (Array.isArray(hosts)) {
      return hosts;
    }
    return hosts.split(',').map(h => h.trim());
  }
  if (host) {
    if (Array.isArray(host)) {
      return host;
    }
    return host.split(',').map(h => h.trim());
  }
  throw new Error('No clients defined to connect to in host or hosts');
};

const getCreds = ({ privateKey, privateKeyFile, username, password }) => {
  if (!username) {
    username = defaultUsername;
  }
  if (password) {
    return {
      username,
      password
    };
  }
  privateKeyFile = privateKeyFile ? privateKeyFile[0] : privateKeyFile;
  if (privateKeyFile) {
    return {
      username,
      privateKey: loadFile(privateKeyFile)
    };
  }
  if (privateKey) {
    return {
      username,
      privateKey
    };
  }
  if (defaultPassword) {
    return {
      username,
      password: defaultPassword
    };
  }
  return {
    username,
    privateKey: defaultPrivateKey
  };
};

const execRemote = (
  { limit = 5, tunnel, agent, commands, creds, clients },
  callback
) => {
  const { username, password, privateKey } = creds;
  Async.mapLimit(
    clients,
    limit,
    (host, next) => {
      logger.debug(
        tunnel ? `Executing on ${host} via ${tunnel}` : `Executing on ${host}`,
        commands
      );
      return exec(
        {
          tunnel,
          host,

          username,
          password,
          privateKey,
          agent,
          commands,
          progress(data) {
            logger.debug(data);
          }
        },
        (error, result) => {
          return next(null, { error, host, ...result });
        }
      );
    },
    callback
  );
};

server.get('/addressbook', (req, res) => res.send(addressbook));
server.get('/recipes', (req, res) => res.send(recipes));

server.post('/', uploads, (req, res) => {
  const payload = req.body;
  if (!payload) {
    return res.status(400).send('Invalid request');
  }
  logger.debug('Incoming Request:', payload);
  try {
    const { tunnel } = payload;
    const commands = getCommands(payload);
    const creds = getCreds({ ...payload, ...req.files });
    const clients = getClients(payload);
    const limit = getLimit(payload);
    return execRemote(
      { limit, tunnel, agent, commands, creds, clients },
      (errors, results) => {
        if (errors) {
          return res.send(errors);
        }
        return res.send(results);
      }
    );
  } catch (e) {
    return server.sendError(res, e);
  }
});

server.start();
