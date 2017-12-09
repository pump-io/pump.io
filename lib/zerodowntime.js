// zerodowntime.js
//
// Used to determine if zero-downtime restart is safe
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
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

// When bin/pump is performing a zero-downtime restart, it loads this
// module and compares this number with its version. If the new
// version is greater than the old version, it will refuse.
//
// Basically, just increment this whenever online restarting is
// potentially harmful. For example, when bin/pump is changed (because
// this would leave you with an old bin/pump managing newer worker
// processes).

const ZERODOWNTIME_EPOCH = 0;

module.exports = ZERODOWNTIME_EPOCH;
