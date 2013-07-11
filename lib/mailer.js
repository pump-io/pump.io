// mailer.js
//
// mail-sending functionality for pump.io
//
// Copyright 2013, E14N https://e14n.com/
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

require("set-immediate");

var _ = require("underscore"),
    Queue = require("jankyqueue"),
    nodemailer = require("nodemailer");

var Mailer = {},
    maillog,
    from,
    transport;

Mailer.setup = function(config, log) {

    var hostname = config.hostname,
        mailopts = {
            host: config.smtpserver,
            auth: {
                user: config.smtpuser || null,
                pass: config.smtppass || null
            },
            secureConnection: config.smtpusessl || false,
            port: config.smtpport || ((config.smtpusessl) ? 465 : 25),
            ignoreTLS: _.has(config, "smtpusetls") ? !config.smtpusetls : false
        };

    maillog = log.child({component: "mail"}),

    from = config.smtpfrom || "no-reply@"+hostname;

    maillog.info(_.omit(mailopts, "password"), "Connecting to SMTP server");

    transport = nodemailer.createTransport("SMTP", mailopts);
};

Mailer.sendEmail = function(props, callback) {

    var message = _.extend({"from": from}, props),
        transport;

    maillog.info({to: message.to || null,
                  subject: message.subject || null}, "Sending email");

    transport.sendMail(message, function(err, response) {
        if (err) {
            maillog.error(err);
            maillog.error({to: message.to || null,
                           subject: message.subject || null,
                           message: err.message},
                          "Email error");
            callback(err, null);
        } else {
            maillog.info({to: message.to || null,
                          subject: message.subject || null},
                         "Message sent");
            callback(null, response);
        }
    });
};

module.exports = Mailer;
