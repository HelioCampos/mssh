const config = require('./config');
const fs = require('fs');
const os = require('os');
const homeDirectory = os.homedir();

const pathWithTilde = pathWithTilde => {
  if (typeof pathWithTilde !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof pathWithTilde}`);
  }

  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde;
};

const getDefaultPrivateKey = () => {
  const fn = pathWithTilde(config.sshKeyFile || '~/.ssh/id_rsa');

  const defaultPrivateKey = fs.existsSync(fn)
    ? fs.readFileSync(fn).toString()
    : '';

  return defaultPrivateKey;
};

module.exports = config.sshKey || getDefaultPrivateKey();
