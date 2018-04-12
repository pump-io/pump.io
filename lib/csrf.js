// lib/csrf.js
//
// Cross-site Request Forgery (CSRF) protection
//
// Copyright 2018, E14N https://e14n.com/
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

var csurf = require("csurf");

// Not all routes should use CSRF (e.g., the API), so we add this middleware
// where it's needed. We only create one instance so we don't have conflicting
// session CSRF tokens popping up everywhere.

// Defaults to look for _csrf in form bodies. Adds req.csrfToken() method

var csrfProtect = csurf();

// For utility, we add _csrf to the res.locals object

var csrf = function(req, res, next) {
    csrfProtect(req, res, function(err) {
        if (err) {
            next(err);
        } else {
            res.locals._csrf = req.csrfToken();
            next();
        }
    });
};

exports.csrf = csrf;
