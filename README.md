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

### Configuration

pump.io uses a JSON file for configuration. It should be at
`/etc/pump.io.json` or on `~/.pump.io.json`.

The `pump.io.json.sample` file should give you an idea of how to use
it.

You can override the config file location with the `-c` option.

    pump -c <CONFIG_FILE>

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
* Glyphicons, http://glyphicons.com/ (CC-By)

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
