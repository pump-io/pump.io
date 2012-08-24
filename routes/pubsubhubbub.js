// routes/pubsubhubbub.js
//
// The hub part of push management
//
// Copyright 2011-2012, StatusNet Inc.
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

// Initialize the app controller

var theHub = null;

var setHub = function(hub) {
    theHub = hub;
};

var addRoutes = function(app) {
    app.post('/api/push/hub', hub);
};

var namespacedParams = function(body) {
    var params = {}, dotted, dot, namespace, name;
    
    for (dotted in body) {
        dot = dotted.indexOf(".");
        if (dot !== -1) {
            namespace = dotted.substr(0, dot);
            name = dotted.substr(dot + 1);
        } else {
            namespace = "__default__";
            name = dotted;
        }
        if (!params.hasOwnProperty(namespace)) {
            params[namespace] = {};
        }
        params[namespace][name] = body[dotted];
    }

    return params;
};

var hub = function(req, res) {
    var params = namespacedParams(req.body);

    switch (params.hub.mode) {
    case 'subscribe':
        theHub.subscribe(params, function(err, results) {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end(err.message);
            } else {
                res.writeHead(204);
                res.end();
            }
        });
        break;
    case 'unsubscribe':
        theHub.unsubscribe(params, function(err, results) {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end(err.message);
            } else {
                res.writeHead(204);
                res.end();
            }
        });
        break;
    case 'publish':
    default:
        res.writeHead(400, {"Content-Type": "text/plain"});
        res.end("That's not a mode this hub supports.");
    }
};

exports.addRoutes = addRoutes;
exports.setHub    = setHub;