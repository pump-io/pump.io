// bundles.js
//
// Serve up some sweet Browserify bundles
//
// Copyright 2018 AJ Jordan <alex@strugee.net>
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

var browserify = require("browserify-middleware"),
    path = require("path");

var addRoutes = function(app) {
    app.get("/javascript/pump.js", browserify(path.join(__dirname, "../public/javascript/pump.js")));
};

exports.addRoutes = addRoutes;
