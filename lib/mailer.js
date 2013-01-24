// mailer.js
//
// mail-sending functionality for pump.io
//
// Copyright 2013, StatusNet Inc.
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

var _ = require("underscore"),
    email = require("emailjs");

var Mailer = {},
    maillog,
    from,
    smtp;

Mailer.setup = function(config, log) {

    var hostname = config.hostname,
        mailopts = {
            user: config.smtpuser || null,
            password: config.smtppass || null,
            host: config.smtpserver,
            port: config.smtpport || 25,
            ssl: config.smtpusessl || false,
            tls: config.smtpusetls || true,
            domain: hostname
        };

    maillog = log.child({component: "mail"}),

    maillog.info(_.omit(mailopts, "password"), "Connecting to SMTP server");

    smtp = email.server.connect(mailopts);

    from = config.smtpfrom || "no-reply@"+hostname;
};

Mailer.sendEmail = function(props, callback) {

    var message = _.extend({"from": from}, props);

    smtp.send(message, function(err, message) {
        if (err) {
            maillog.error({to: message.to || null,
                           subject: message.subject || null},
                          "Sending email");
            callback(err, null);
        } else {
            maillog.info({to: message.to || null,
                          subject: message.subject || null},
                         "Message sent");
            callback(null, message);
        }
    });
};

module.exports = Mailer;
