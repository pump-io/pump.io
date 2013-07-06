// uuidv5.js
//
// Make a v5 UUID from a string
//
// Copyright 2011-2013, E14N https://e14n.com/
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

// Originally from uuid.js

//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php
//
// Branch for v5 UUIDs by OrangeDog
// http://github.com/OrangeDog

var _ = require("underscore"),
    crypto = require('crypto');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into its component bytes**
function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
	if (ii < 16) { // Don't overflow!
            buf[i + ii++] = _hexToByte[oct];
	}
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
	buf[i + ii++] = 0;
    }

    return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
        bth[buf[i++]] + bth[buf[i++]] + '-' +
        bth[buf[i++]] + bth[buf[i++]] + '-' +
        bth[buf[i++]] + bth[buf[i++]] + '-' +
        bth[buf[i++]] + bth[buf[i++]] + '-' +
        bth[buf[i++]] + bth[buf[i++]] +
        bth[buf[i++]] + bth[buf[i++]] +
        bth[buf[i++]] + bth[buf[i++]];
}

function uuidv5(data, ns) {
    var i, v;
    var output = new Buffer(16);

    if (!data) {
	for (i=0; i<16; i++) {
            output[i] = 0;
	}
	return unparse(output);
    }

    if (typeof ns === 'string') {
	ns = parse(ns, new Buffer(16));
    }

    var hash = crypto.createHash('sha1');
    hash.update(ns || '');
    hash.update(data || '');

    v = 0x50;

    var digest = hash.digest();

    if (_.isString(digest)) {
        output.write(digest, 0, 16, 'binary');
    } else if (_.isObject(digest) && digest instanceof Buffer) {
        digest.copy(output);
    }

    output[8] = output[8] & 0x3f | 0xa0; // set variant
    output[6] = output[6] & 0x0f | v; // set version

    return unparse(output);
}

var namespaces = {
    DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    OID: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
    X500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8'
};

module.exports = uuidv5;
uuidv5.ns = namespaces;
