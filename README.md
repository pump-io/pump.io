# pump.io

This is pump.io. It's a stream server that does most of what people
really want from a social network.

[![Build Status](https://travis-ci.org/pump-io/pump.io.svg?branch=master)](http://travis-ci.org/pump-io/pump.io)
[![Coverage Status](https://coveralls.io/repos/github/pump-io/pump.io/badge.svg?branch=master)](https://coveralls.io/github/pump-io/pump.io?branch=master)
[![npm](https://img.shields.io/npm/v/pump.io.svg)](https://npmjs.com/package/pump.io)
[![NSP Status](https://nodesecurity.io/orgs/pumpio/projects/32213bb8-f9a6-4dd0-8fc6-5caa8ea5f8fc/badge)](https://nodesecurity.io/orgs/pumpio/projects/32213bb8-f9a6-4dd0-8fc6-5caa8ea5f8fc)
[![Greenkeeper badge](https://badges.greenkeeper.io/pump-io/pump.io.svg)](https://greenkeeper.io/)

## What's it for?

I post something and my followers see it. That's the rough idea behind
the pump.

There's an API defined in the API.md file. It uses activitystrea.ms
JSON as the main data and command format.

You can post almost anything that can be represented with activity
streams -- short or long text, bookmarks, images, video, audio,
events, geo checkins. You can follow friends, create lists of people,
and so on.

The software is useful for at least these scenarios:

* Mobile-first social networking
* Activity stream functionality for an existing app
* Experimenting with social software

It also comes with a web UI.

## External documentation

For information about project policies please check out the [GitHub
wiki](https://github.com/pump-io/pump.io/wiki), and for technical
documentation see our
[ReadTheDocs](https://pumpio.readthedocs.io/en/latest/) website.

## Installation

### Prerequisites

You'll need four things to get started:

* node.js 4.x or higher
* npm 1.1.0 or higher
* A database server (see below)
* The `graphicsmagick` package with the `gm` command

Note that the requirement to have `gm` available is new for 0.3.0; if
you're upgrading, you need to install it.

### Install with npm

The easiest way is to install the software globally using npm, like
so:

    npm install -g pump.io

That should set up all the files and dependencies for you.

### Local install

If you want to set up the software in its own directory, you can clone
the git repository, so:

    git clone https://github.com/pump-io/pump.io.git

You can then install the dependencies using `npm`:

    cd pump.io
    npm install
    npm run build

To test the install, run:

    npm test

### Database setup

pump.io uses [databank](https://github.com/evanp/databank)
package to abstract out the data storage for the system. Any databank
driver should work. Couchbase, MongoDB and Redis are probably the best
bets for production servers, but the `disk` or even `memory` drivers
can work for testing.

If you're confused, just use the MongoDB one, `databank-mongodb`.

You can find other drivers like so:

    npm search databank

You can install in the `pump.io` directory as a normal dependency.
For example, the databank driver for MongoDB:

    npm install databank-mongodb

Note that you also need to install and configure your database server.

 

### Configuration

pump.io uses a JSON file for configuration. It should be at
`/etc/pump.io.json` or on `~/.pump.io.json`.

The `pump.io.json.sample` file should give you an idea of how to use
it.

The default config values are stored in the source file `lib/defaults.js`.

You can override the config file location with the `-c` option.

    pump -c <CONFIG_FILE>

Here are the main configuration keys.

* *driver* The databank driver you're using. Defaults to "memory", which
  is probably going to be terrible.
* *params* Databank driver params; see the databank driver README for
   details on what to put here.
* *hostname* The hostname of the server. Defaults to "127.0.0.1" which
   doesn't do much for you.
* *address* The address to listen on. Defaults to `hostname`, which is
   OK for most systems. Use this if you've got some kind of
   load-balancer or NAS or whatever and your local IP doesn't map to
   the IP of the hostname.
* *port* Port to listen on. Defaults to 31337, which is no good. You
   should listen on 80 or 443 if you're going to have anyone use this.
* *urlPort* Port to use for generating URLs. Defaults to the same as `port`,
  but if you're insisting on proxying behind Apache or whatever despite
  warnings not to, you can use this.
* *bounce* If `true`, set up a mini-server on port 80 that redirects to HTTPS
* *secret* A session-generating secret, server-wide password.
* *noweb* Hide the Web interface. Defaults to `false`. Set this to something
  truthy to disable the Web interface.
* *site* Name of the server, like "My great social service". Defaults to
  "pump.io".
* *owner* Name of owning entity, if you want to link to it.
* *ownerURL* URL of owning entity, if you want to link to it.
* *appendFooter* a bit of custom HTML you want appended to the footer text.
* *nologger* If you're debugging or whatever, turn off
  logging. Defaults to false (leave logging on).
* *logfile* Full path to the logfile. Logs are JSON in
  [bunyan](https://github.com/trentm/node-bunyan) format.
* *logLevel*: Log level used by bunyan
  ([bunyan loglevels](https://github.com/trentm/node-bunyan#levels)); default
  is "info"
* *serverUser* If you're listening on a port lower than 1024, you need
  to be root. Set this to the name of a user to change to after the
  server is listening. `daemon` or `nobody` are good choices, or you
  can create a user like `pump` and use that.
* *key* If you're using SSL, the path to the server key, like
   "/etc/ssl/private/myserver.key".
* *cert* If you're using SSL, the path to the server cert, like
   "/etc/ssl/private/myserver.crt".
* *hsts* Controls the HTTP `Strict-Transport-Security` header. It's passed
  directly to the [hsts](https://www.npmjs.com/package/hsts) module, so you can
  set `true` to use the defaults (180 days, `includeSubdomains` is on) or set
  an object to use a longer time, enable preloading, etc. The default is `false`.
* *uploaddir* Obsolete; see issue #1261
* *datadir* Directory for the server to store data in (mostly uploads). Should
  be the full path of a local directory that's readable and writeable by the
  `serverUser`. Optional unless you have uploads turned on.
* *enableUploads* If you want to enable file uploads, set this to `true`. Make
  sure that `datadir` is set and that the directory it's set to contains a
  subdirectory named `uploads`.
* *debugClient* For developers, if you're debugging the Web interface
  and you want to use the non-minified version of the JavaScript libraries,
  set this to `true`. Defaults to `false`, which is what people should
  use in production.
* *firehose* Firehose host running the
   [ofirehose](https://github.com/e14n/ofirehose) software. Defaults
   to "ofirehose.com". Public notices will ping this firehose
   server and from there go out to search engines and the world. If
   you want to disconnect from the public web, set this to something
   falsy.
* *spamhost* Host running activityspam software to use to test updates for spam.
* *spamclientid* oauth pair for spam server.
* *spamclientsecret* oauth pair for spam server.
* *disableRegistration* default false. Disables registering new users on the
  site through the Web or the API.
* *noCDN* Use local copies of the JavaScript libraries instead of the
   ones on the CDN. Good for debugging. Defaults to `false`, meaning
   "use the CDN".
* *requireEmail* Require an email address to register. Should be ignored if email
  server isn't configured. Default `false`.
* *smtpserver* Server to use for sending transactional email. If it's not set up,
  no email is sent and features like password recovery and email notification won't
  work. Defaults to `null`.
* *smtpport* Port to connect to on SMTP server. Defaults to `25` which is really the only
  sane value.
* *smtpuser* Username to use to connect to SMTP server. Might not be necessary for some
  servers. Defaults to `null`.
* *smtppass* Password to use to connect to SMTP server. Might not be necessary for some
  servers. Defaults to `null`.
* *smtpusetls* Try to negotiate using SSL with the SMTP server. Defaults to `true`, because
  it's a smart idea.
* *smtpusessl* Only use SSL with the SMTP server. Defaults to `false`. You may need to change
  the `smtpport` value if you set this.
* *smtptimeout* Timeout for connecting to the SMTP server in milliseconds. Defaults to `30000`.
  Change this if... I dunno. I see no reason to change this.
* *smtpfrom* Email address to use in the "From:" header of outgoing notifications. Defaults to 'no-reply@'
  plus the site hostname.
* *compress* Use gzip or deflate to compress text output. This can cut down on network
  transfers considerably at the expense of memory and CPU on the server. Defaults to `true`.
* *children* Number of children to run. Defaults to 1 for some kinds of DBs, number of CPUS - 1 for others.
* *clients*. You can pre-configure some OAuth credentials if you want to have a replicable
  configuration (say, for test scripts or development environments). This setting is
  an array of objects, each of which has a 'client_id' and 'client_secret' property, and
  an optional 'title' and 'description' object. Most people don't need this. Default is an empty list.
* *sockjs* Use [SockJS-node](https://github.com/sockjs/sockjs-node) to provide a realtime connection. Defaults
  to `true`.
* *cleanupSession* Time interval to clean up sessions (in ms). These are staggered a bit if you have
  more than one child process running, to spread them out a bit. Defaults to 1200000, or 20 minutes.
* *cleanupNonce* Time interval to clean up OAuth nonces (in ms). Staggered.
  Defaults to 1200000, or 20 minutes.
* *favicon* Local filesystem path to the favicon.ico file to use. This will be served as "/favicon.ico"
  by the server. By default, uses public/images/favicon.ico.

You can also set these by passing commandline flags starting with
`--` - for example, `pump.io.json`'s `port` value can be set by
passing `--port`. Camelcasing like `urlPort` should be replaced with
`-` (i.e.  `urlPort` becomes `--url-port`). Keys whose value is an
object can be specified using `.` to separate nested keys. For
example, a `pump.io.json` with the following contents:

    { "params": { "host": "localhost" } }

can be set by passing `--params.host localhost`.

### Web server proxy

pump.io is designed to be a standalone server. You do not need
to set up an Apache or nginx or lighttpd Web server in front of
it. In fact, that's going to make things harder for you, and stuff
like WebSockets is going to work less well.

If you really insist, check the configuration options carefully. If
you want http://pump.yourdomain.example/ to proxy to the pump.io
daemon listening on port 8000 on 127.0.0.1, use configuration options
like this:

    "hostname": "pump.yourdomain.example",
    "urlPort": 80,
    "address": "127.0.0.1",
    "port": 8000

## Running the daemon

To run the pump.io daemon, you need to run either `./bin/pump` (if you
installed from git) or `pump` (if you installed from npm).

You'll probably get a more reliable experience if you use
[forever](https://npmjs.org/package/forever) to keep the daemon running.

### Environment

`NODE_ENVIRONMENT` determines the environment pump.io is running
in. This should be set to `production` in production environments or
performance will be significantly degraded. In development
environments it should be set to `development`, which is the default.

The `pump` daemon also accepts configuration values via environment
variables. You can find available configuration values above - the
basic idea is to start with `PUMPIO_` and append the capitalized
configuration key you want to set. For example, the `port` key in
`pump.io.json` would translate to the environment variable
`PUMPIO_PORT`. To configure camelcased config values like `urlPort`,
replace the camelcasing with an underscore (`_`). For example,
`urlPort` would become `PUMPIO_URL_PORT`. Keys whose value is an
object can be specified using `__` (two underscores) to separate
subkeys. For example, a `pump.io.json` with the following contents:

    { "params": { "host": "localhost" } }

can be represented by exporting `PUMPIO_PARAMS__HOST` to the
environment with a value of `localhost`.

You can also set the env variable `NODE_DEBUG` to enable debugging of
internal libraries.

Example:

    export NODE_DEBUG=dev,all,net,http,fs,tls,module,timers

See [How to set NODE_DEBUG](http://www.juliengilli.com/2013/05/26/Using-Node.js-NODE_DEBUG-for-fun-and-profit/).

## Using the command line tools

You can use any pump.io client application you want to interact with
pump.io servers. However, this repository comes with some samples to
get you started, if you want.

### pump-register-app

First use this tool to create the credentials file

    ./bin/pump-register-app  -t <APPNAME>

`<APPNAME>` will be the name of the client app that
`pump-register-app` registers with the server.

This will create the file `~/.pump.d/<SERVER>.json` that contains your credentials.

    {
    "client_id":"XXXX",
    "client_secret":"YYYYY",
    "expires_at":0
    }

It will also add an entry into the server database where you will find
the clientID. Note that if you use the memory Databank driver the data
will be lost between server runs and you will need to rerun the
configuration.

#### pump-register-user

Use this command to register a user:

    ./bin/pump-register-user  -u <USERNAME> -p <PASSWORD>

### pump-authorize

After you register an app, you can authorize your user to use it.

    ./bin/pump-authorize -u <USERNAME>

When you do that it will ask you to open a website, login and verify the
value. You paste that back in and all is good.

## Making changes

If you're connecting your pump.io site with other software (such as
federated servers or using Web clients), please note that most of them
save OAuth keys based on your hostname and listening port. The
following changes may make your relationships stop working.

* Change of hostname
* Change of port (from 8000 to 80 or even from HTTP to HTTPS)
* Clearing your database or clearing some tables
* Changing user nicknames

I realize that these kind of changes are normal when someone's
experimenting with new software, and I'm trying to make the software
more robust in the face of this kind of change without sacrificing
security, but for now it's a good idea to decide on your "real" domain
name first before making connections to other sites.

## Bugs

If you find bugs, you can report them here:

https://github.com/pump-io/pump.io/issues

You can also email me at evan@e14n.com.

## Colophon

This software includes the following great packages of client-side software.

* Twitter Bootstrap
* Backbone
* JQuery
* Fine Uploader
* WysiHTML5
* Spin.js
* SockJS
* Select2
* JQuery Easydate
* OAuth.js

It also uses these icon sets:

* Fancy Avatars, © 2009 Brandon Mathis, http://brandonmathis.com/projects/fancy-avatars/ (CC-By)
* Font Awesome by Dave Gandy, http://fontawesome.io/ (SIL Open Font License 1.1)

This sample photo is used for the main page:

* http://www.flickr.com/photos/makelessnoise/240072395/ (CC-by)

## License

Copyright 2011-2017, E14N https://e14n.com/ and contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
