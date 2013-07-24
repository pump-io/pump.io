# pump.io

Version 0.3.0-alpha.1

This is pump.io. It's a stream server that does most of what people
really want from a social network.

[![Build Status](https://secure.travis-ci.org/e14n/pump.io.png)](http://travis-ci.org/e14n/pump.io)

## License

Copyright 2011-2013, E14N https://e14n.com/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

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

Version 0.2.0 will have a Web UI, which will probably make the whole
thing much more enjoyable.

## Installation

### Prerequisites

You'll need four things to get started:

* node.js 0.8.0 or higher
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

    git clone https://github.com/e14n/pump.io.git

You can then install the dependencies using `npm`:

    cd pump.io
    npm install

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

One tricky bit is that the driver you use has to be available to the
`databank` package. There are two ways to make that work.

First, you can install globally. For example:

    npm install -g databank-mongodb

Use this if you installed the pump.io package globally.

Second, you can install in the `databank` directory.

    cd pump.io/node_modules/databank
    npm install databank-mongodb

Note that you also need to install and configure your database server.

### Configuration

pump.io uses a JSON file for configuration. It should be at
`/etc/pump.io.json`.

The `pump.io.json.sample` file should give you an idea of how to use
it.

Here are the main configuration keys.

* *driver* The databank driver you're using. Defaults to "disk", which
  is probably going to be terrible.
* *params* Databank driver params; see the databank driver README for
   details on what to put here.
* *hostname* The hostname of the server. Defaults to "localhost" which
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
* *secret* A session-generating secret, server-wide password.
* *noweb* Hide the Web interface. Since it's disabled for this release,
  this shouldn't cause you any problems.
* *site* Name of the server, like "My great social service".
* *owner* Name of owning entity, if you want to link to it.
* *ownerURL* URL of owning entity, if you want to link to it.
* *nologger* If you're debugging or whatever, turn off
  logging. Defaults to false (leave logging on).
* *logfile* Full path to the logfile. Logs are JSON in
  [https://github.com/trentm/node-bunyan](bunyan) format.
* *serverUser* If you're listening on a port lower than 1024, you need
  to be root. Set this to the name of a user to change to after the
  server is listening. `daemon` or `nobody` are good choices, or you
  can create a user like `pump` and use that.
* *key* If you're using SSL, the path to the server key, like
   "/etc/ssl/private/myserver.key".
* *cert* If you're using SSL, the path to the server cert, like
   "/etc/ssl/private/myserver.crt".
* *uploaddir* If you want to enable file uploads, set this to the
  full path of a local directory. It should be writeable and readable by the
  'serverUser'.
* *debugClient* For developers, if you're debugging the Web interface
  and you want to use the non-minified version of the JavaScript libraries,
  set this to `true`. Defaults to `false`, which is what people should
  use in production.
* *firehose* Firehose host running the
   [ofirehose](https://github.com/e14n/ofirehose) software. Defaults
   to "ofirehose.com". Public notices will be ping this firehose
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
  work. Defaults to `undefined`.
* *smtpport* Port to connect to on SMTP server. Defaults to `25` which is really the only
  sane value.
* *smtpuser* Username to use to connect to SMTP server. Might not be necessary for some
  servers. Defaults to `undefined`.
* *smtppass* Password to use to connect to SMTP server. Might not be necessary for some
  servers. Defaults to `undefined`.
* *smtpusetls* Try to negotiate using SSL with the SMTP server. Defaults to `true`, because
  it's a smart idea.
* *smtpusessl* Only use SSL with the SMTP server. Defaults to `false`. You may need to change
  the `smtpport` value if you set this.
* *compress* Use gzip or deflate to compress text output. This can cut down on network
  transfers considerably at the expense of memory and CPU on the server. Defaults to `false`.
* *children* Number of children to run. Defaults to 1 for some kinds of DBs, number of CPUS - 1 for others.
* *clients*. You can pre-configure some OAuth credentials if you want to have a replicable
  configuration (say, for test scripts or development environments). This setting is
  an array of objects, each of which has a 'client_id' and 'client_secret' property, and
  an optional 'title' and 'description' object. Most people don't need this. Default is an empty list.

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

You'll probably get a more reliable experience if you use
[forever](https://npmjs.org/package/forever) to keep the daemon running.

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

https://github.com/e14n/pump.io/issues

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
* Glyphicons, http://glyphicons.com/ (CC-By)

This sample photo is used for the main page:

* http://www.flickr.com/photos/makelessnoise/240072395/ (CC-by)
