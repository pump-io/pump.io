// lib/api.js
//
// Shared utilities for the classic API and the ActivityPub API
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

"use strict";

var DEFAULT_ITEMS = 20,
    MAX_ITEMS = DEFAULT_ITEMS * 10;

module.exports.DEFAULT_ITEMS = DEFAULT_ITEMS;
module.exports.MAX_ITEMS = MAX_ITEMS;
