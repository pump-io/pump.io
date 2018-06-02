// proxy-route-e2e-test.js
//
// Test the proxy route
//
// Copyright 2012, E14N https://e14n.com/
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    URLMaker = require("../dist/lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    httputil = require("./lib/http"),
    withAppSetup = apputil.withAppSetup,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("proxy route");

suite.addBatch(
    withAppSetup({
        "and we check the dialback endpoint":
        httputil.endpoint("/api/proxy/AAAAAAAA", ["GET"])
    })
);

suite["export"](module);
