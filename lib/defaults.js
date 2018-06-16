// pump.io
//
// entry point activity pump application
//
// Copyright 2011-2012, E14N https://e14n.com/
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

var path = require("path");

// Note that values set to `null` are occasionally set dynamically in bin/pump or config.js

module.exports = {driver: "memory",
                  params: {},
                  hostname: "127.0.0.1",
                  address: null,
                  port: 31337,
                  urlPort: null,
                  bounce: false,
                  secret: null,
                  noweb: false,
                  site: "pump.io",
                  owner: null,
                  ownerURL: null,
                  mainImage: "images/somefriends.jpg",
                  appendFooter: null,
                  nologger: false,
                  logfile: null,
                  logLevel: "info",
                  serverUser: null,
                  key: null,
                  cert: null,
                  hsts: false,
                  datadir: null,
                  enableUploads: false,
                  debugClient: false,
                  firehose: "ofirehose.com",
                  spamhost: null,
                  spamclientid: null,
                  spamclientsecret: null,
                  disableRegistration: false,
                  noCDN: false,
                  requireEmail: false,
                  smtpserver: null,
                  smtpport: 25,
                  smtpuser: null,
                  smtppass: null,
                  smtpusetls: true,
                  smtpusessl: false,
                  smtpfrom: null,
                  smtptimeout: 30000,
                  compress: true,
                  children: null,
                  clients: [],
                  sockjs: true,
                  // XXX should we document this or remove it?
                  // And if we do document it, adjust the yargs validation
                  urlPath: null,
                  // XXX ditto
                  plugins: [],
                  // XXX ditto
                  scripts: [],
                  // XXX ditto
                  proxyWhitelist: [],
                  // XXX ditto
                  redirectToCanonical: true,
                  // XXX ditto
                  redirectAddressToCanonical: false,
                  cleanupSession: 1200000,
                  cleanupNonce: 1200000,
                  favicon: path.resolve(__dirname, "../public/images/favicon.ico"),
                  users: [],
                  controlSocket: "/run/pump.socket"
                 };
