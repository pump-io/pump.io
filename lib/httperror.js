// lib/httperror.js
//
// An error class that knows the "right" HTTP status code
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

// Create a new object, that prototypally inherits from the Error constructor.  

var HTTPError = function(message, code) {
    if (!code) {
        code = 500;
    }
    Error.captureStackTrace(this, HTTPError);
    this.name = "HTTPError";  
    this.message = message || "Server error";  
    this.code = code;
};

HTTPError.prototype = new Error();  
HTTPError.prototype.constructor = HTTPError;

exports.HTTPError = HTTPError;
