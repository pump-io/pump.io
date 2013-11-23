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

var path = require("path");

module.exports = {driver: "memory",
                  params: {},
                  hostname: "127.0.0.1",
                  address: null,
                  port: 31337,
                  urlPort: null,
                  secret: null,
                  noweb: false,
                  site: "pump.io",
                  owner: null,
                  ownerURL: null,
                  nologger: false,
                  logfile: null,
                  serverUser: null,
                  key: null,
                  cert: null,
                  uploaddir: null,
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
                  smtptimeout: null,
                  smtpfrom: null,
                  compress: true,
		  clients: [],
                  sockjs: true,
                  urlPath: null,
                  plugins: [],
                  scripts: [],
                  proxyWhitelist: [],
                  redirectToCanonical: true,
                  redirectAddressToCanonical: false,
                  cleanupSession: 1200000,
                  cleanupNonce: 1200000,
                  favicon: path.resolve(__dirname, "../public/images/favicon.ico")
                 };
