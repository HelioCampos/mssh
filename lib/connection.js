const Client = require('ssh2').Client;

const wrapToCallback = (proc, callback) => {
  const p = new Promise(proc);
  if (typeof callback === 'function') {
    return p.then(res => callback(null, res)).catch(err => callback(err));
  }
  return p;
};

const doConnection = (connectionOptions, conn, done) => {
  conn
    .on('ready', () => {
      done(null, conn);
    })
    .on('error', err => done(err))
    .connect(connectionOptions);
};

class Connection {
  constructor(options = {}) {
    this.options = options;
  }

  open(callback) {
    return wrapToCallback((resolve, reject) => {
      if (this.conn) {
        return resolve(this);
      }
      const {
        tunnel,
        host,
        port = 22,
        username,
        password,
        privateKey,
        progress,
        agent
      } = this.options;
      const connectionOptions = {
        host,
        port,
        username,
        password,
        privateKey,
        agent
      };
      const conn = (this.conn = new Client());
      if (tunnel) {
        const tunnelConn = (this.tunnelConn = new Client());
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
                return reject(err);
              }
              doConnection(
                Object.assign(
                  { sock: stream, agentForward: !!agent },
                  connectionOptions
                ),
                this.conn,
                err => {
                  if (err) {
                    return reject(err);
                  }
                  return resolve(this);
                }
              );
            });
          })
          .connect(tunnelOptions);
      }
      return doConnection(connectionOptions, this.conn, err => {
        if (err) {
          return reject(err);
        }
        return resolve(this);
      });
    }, callback);
  }

  close(callback) {
    return wrapToCallback((resolve, reject) => {
      if (this.conn) {
        this.conn.end();
        this.conn = null;
      }
      if (this.tunnelConn) {
        this.tunnelConn.end();
        this.tunnelConn = null;
      }
      return resolve(this);
    }, callback);
  }
}

module.exports = {
  Connection
};
