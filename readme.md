# mssh

Web based multi-ssh client.

## To-Do

 - [x] Execute command or commands on multiple hosts
 - [x] Connect to destination via a tunnel
 - [x] Output individual results
 - [x] Address book
 - [x] Address book UI support
 - [x] Cookbook for recipes
 - [x] Cookbook for recipes in UI
 - [x] Support terminal output
 - [ ] SCP file(s) to target(s)
 - [ ] Allow lookup from addressbook for dynamic entry values
 - [ ] Perform operations asynchronously
 - [ ] Use websockets
 - [ ] Skin Support

## Supported OS

 - [x] Linux (Ubuntu)
 - [ ] Mac (not tested, should work)
 - [ ] Windows

## Configuration

### Address Book

addressbook.(yaml, yml, json, js)

```
{name}:
  hosts:
    - {host}
    - {host}
  tunnel: {host}
  ...
{name}:
  hosts:
    - {host}
    - {host}
  tunnel: {host}
  ...
```

### Cookbook

recipes.(yaml, yml, json, js)

```
{name}:
  - {command}
{name}:
  - {command}
```

### Environment Variables

 - SSH_USERNAME  - Default username (if not supplied by the UI) to connect with.
 - SSH_PASSWORD  - Default password (if not supplied by the UI) to connect with.
 - SSH_AUTH_SOCK - contains the path of the unix file socket that the agent uses for communication with other processes.
 - SSH_KEY_FILE  - Location of key file (if not supplied by the UI) to connect with.
 - SSH_KEY       - Key (if not supplied by the UI) to connect with.

### .env file

See Environment Variables above.

### Command Line Options

Any Environment Variable can be passed in on the command line by changing it to camelCase.

**Example:**

```
node server.js --sshUsername testdummy
```

## Usage

### As a container

```
docker run -d -v ${HOME}/.ssh/:/root/.ssh/ -e SSH_USERNAME=$(whoami)  eonclash/mssh
```

### Locally

```
yarn build
yarn start
```

### On a production server

Not recommended to be ran standalone on a production server.

## Debugging

```
yarn dev
```

## API

### POST://

**Payload:**

```js
{
  hosts: [],      // Array of IP addresses or host names to connect to
  tunnel: '',     // SSH Tunnel, proxy, bastion, ... to use (optional)
  username: '',   // Username to connect with (optional)
  password: '',   // Password to connect with (optional)
  privateKey: '', // SSH Key to connect with (optional)
  privateKeyFile: File(), // SSH Key File to connect with (optional)
  commands: []    // Commands to execute
}
```

**NOTE:** Each element in the commands array is executed as a block together in it's own session.  If you pass in ['cd /users/test', 'pwd'] while connecting with a root account the output of the pwd command will be '/root' (assuming that '/root' is the root users home folder).  Instead pass in ['cd /users/test \n pwd'] to execute the pwd in the same shell session.

# Bug Reports and Feature Enhancements

Submit all Bug Reports and Feature Enhancments using the standard GitHub "Issues" and "Pull Requests" please include any details such as how to reproduce an error, reason behind feature request, conceptual designs, etc...

# License

Copyright (c) 2019 Jeremy Darling

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
