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
    email = require("emailjs");

var Mailer = {},
    maillog,
    from,
    mailopts,
    q;

Mailer.setup = function(config, log) {

    var hostname = config.hostname;

    mailopts = {
        user: config.smtpuser || null,
        password: config.smtppass || null,
        host: config.smtpserver,
        port: config.smtpport || 25,
        ssl: config.smtpusessl || false,
        tls: config.smtpusetls || true,
        timeout: config.smtptimeout || 30000,
        domain: hostname
    };

    maillog = log.child({component: "mail"}),

    from = config.smtpfrom || "no-reply@"+hostname;

    q = new Queue(1);
};

Mailer.sendEmail = function(props, callback) {
    props.retries = 0;
    q.enqueue(reallySendEmail, [props], function(err, results) {});
    setImmediate(function() {
        callback(null);
    });
};

var reallySendEmail = function(props, callback) {

    var message = _.extend({"from": from}, props),
        smtp;

    maillog.info({to: message.to || null,
                  subject: message.subject || null}, "Sending email");

    maillog.info(_.omit(mailopts, "password"), "Connecting to SMTP server");

    smtp = email.server.connect(mailopts);

    smtp.send(message, function(err, results) {
        if (err) {
            maillog.error(err);
            maillog.error({to: message.to || null,
                           subject: message.subject || null,
                           message: err.message},
                          "Email error");
            props.retries++;
            if (props.retries >= 3) {
                callback(err, null);
            } else {
                q.enqueue(reallySendEmail, [props], function(err, results) {});
            }
        } else {
            maillog.info({to: message.to || null,
                          subject: message.subject || null},
                         "Message sent");
            callback(null, results);
        }
        smtp.close();
    });
};

module.exports = Mailer;
