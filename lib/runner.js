const getCommands = ({ command, commands, script }) => {
  const src = command || commands || script;
  if (Array.isArray(src)) {
    return src;
  }
  return (src || '').replace(/\r/g, '').split('\n');
};

const Client = require('ssh2').Client;
const logger = require('./logger');
const Async = require('async');

const promisify = (f, ...args) => {
  return new Promise((resolve, reject) => {
    f(...args, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
};

const execute = (options = {}, callback) => {
  const {
    tunnel,
    host,
    port = 22,
    username,
    password,
    privateKey,
    progress,
    agent
  } = options;
  const commands = getCommands(options);
  const conn = new Client();
  const doProgress =
    typeof progress === 'function'
      ? info => {
          progress({ host, port, username, ...info });
        }
      : () => {};

  const connectionOptions = {
    host,
    port,
    username,
    password,
    privateKey,
    agent
  };

  let cbCalled = false;
  const done = (err, res) => {
    if (cbCalled) {
      return;
    }
    cbCalled = true;
    conn.end();
    if (err) {
      logger.error(err);
      return callback(err);
    }
    return callback(null, res);
  };

  const doConnection = (connectionOptions, done) => {
    const { host, port, username } = connectionOptions;
    conn.on('error', err => {
      logger.error('Connection error', err);
      return done(err);
    });
    conn.on('timeout', () => {
      logger.error('Connection timeout', connectionOptions);
      return done(new Error(`Connection timeout`));
    });
    conn.on('ready', () => {
      const res = { stdout: '', stderr: '', all: '', commands: [] };

      return Async.eachSeries(
        commands,
        (command, next) => {
          res.all += `${command}\n`;

          conn.exec(command, (err, stream) => {
            if (err) {
              logger.error('Client::runner::err', err);
              return done(err);
            }

            let stderr = '';
            let stdout = '';
            let all = '';
            doProgress({ command });
            stream
              .on('close', (code, signal) => {
                res.commands.push({
                  command,
                  code,
                  signal,
                  stderr,
                  stdout,
                  all
                });
                return next();
              })
              .on('data', data => {
                const str = data.toString();
                doProgress({ stdout: str });
                stdout += str;
                all += str;
                res.stdout += str;
                res.all += str;
              })
              .stderr.on('data', data => {
                const str = data.toString();
                doProgress({ stderr: str });
                stderr += str;
                all += str;
                res.stderr += str;
                res.all += str;
                return;
              });
          });
        },
        err => done(err, res)
      );
    });
    conn.connect(connectionOptions);
  };

  if (tunnel) {
    const tunnelConn = new Client();
    const tunnelOptions = {
      host: tunnel,
      port,
      username,
      password,
      privateKey,
      agent
    };
    return tunnelConn
      .on('ready', () => {
        tunnelConn.forwardOut('127.0.0.1', 0, host, 22, (err, stream) => {
          if (err) {
            tunnelConn.end();
            return done(err);
          }
          doConnection(
            Object.assign(
              { sock: stream, agentForward: !!agent },
              connectionOptions
            ),
            (...args) => {
              tunnelConn.end();
              done(...args);
            }
          );
        });
      })
      .connect(tunnelOptions);
  }

  return doConnection(connectionOptions, done);
};

module.exports = {
  execute
};
