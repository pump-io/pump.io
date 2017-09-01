// template.js
//
// Template middleware with cache-buster
//
// Copyright 2011-2017, E14N https://e14n.com/ and contributors
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

var fs = require("fs"),
    path = require("path"),
    crypto = require("crypto"),
    _ = require("lodash"),
    jade = require("jade"),
    uglify = require("uglify-js");

var reqTemplate = function(viewsPath, opts) {
    opts = _.extend({
        debug: false,
        maxAge: 86400 * 5,
        hashLength: 8
    }, opts);

    var viewsFiles = fs.readdirSync(viewsPath),
        templates = {},
        templatesHashes = [],
        outputName = "templates",
        blackList = [
            "^account",
            "^authentication",
            "^authorization",
            "^authorization-finished",
            "^confirmed",
            "^confirmation-email-",
            "^doc",
            "^error",
            "^favorites",
            "^followers",
            "^following",
            "^inbox",
            "^javascript-disabled",
            "^list",
            "^lists",
            "^login",
            "^main",
            "^major-activity-page",
            "^minor-activity-page",
            "^object",
            "^recover",
            "^recover-code",
            "^recover-sent",
            "^recovery-email-",
            "^register",
            "^remote",
            "^user",
            "^xss-error",
            "^layout"
        ],
        blackListRegexp = new RegExp("(" + blackList .join("|") + ")\.jade$"),
        templateLicense = "// This file is auto generated and will be overwritten \n" +
        "// @licstart  The following is the entire license notice for the \n" +
        "//  JavaScript code in this page.\n" +
        "// \n" +
        "// Copyright 2011-2017, E14N https://e14n.com/ and contributors\n" +
        "// \n" +
        "// Licensed under the Apache License, Version 2.0 (the \"License\");\n" +
        "// you may not use this file except in compliance with the License.\n" +
        "// You may obtain a copy of the License at\n" +
        "// \n" +
        "//     http://www.apache.org/licenses/LICENSE-2.0\n" +
        "// \n" +
        "// Unless required by applicable law or agreed to in writing, software\n" +
        "// distributed under the License is distributed on an \"AS IS\" BASIS,\n" +
        "// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n" +
        "// See the License for the specific language governing permissions and\n" +
        "// limitations under the License.\n" +
        "// \n" +
        "// @licend  The above is the entire license notice\n" +
        "// for the JavaScript code in this page.\n\n" +
        "// XXX: this needs to be broken up into 3-4 smaller modules \n";


    // Get all files from views directory but only take all .jade files
    _.each(viewsFiles, function(file) {
        var _template = getTemplate(file);
        if (_template) {
            // Add template compile function with hash version
            templates[_template.name] = {
                hash: _template.hash,
                string: _template.string
            };
            templatesHashes.push("\"" + _template.name + "\": " + "\"" + _template.hash + "\"");
        }
    });

    // Return hash by template
    var templatesCode = "if (!window.Pump) {window.Pump = {};}" +
        "(function(Pump) {\"use strict\";" +
        " Pump._templates = { " + templatesHashes.join(",") + "};" +
        "})(window.Pump);";

    // Compress
    if (!opts.debug) {
        templatesCode = uglify.minify(templatesCode, {
            fromString: true
        }).code;
        outputName += ".min";
    }
    // Add license after because uglify remove comments
    templatesCode = templateLicense + templatesCode;
    outputName += ".js";

    // Get templates
    function getTemplate (file) {
        try {
            var templatePath = path.join(viewsPath, file),
                stat = fs.lstatSync(templatePath);


            if (stat.isFile() && !blackListRegexp.test(file) && /\.jade$/.test(file)) {
                var templateName = path.basename(file, ".jade"),
                    templateContent = fs.readFileSync(templatePath, {encoding: "utf8"}),
                    // Compile jade template for client side
                    // 'inlineRuntimeFunctions' option not exist in jade 1.x,
                    // Added for compatibility in future 'pug' upgrades
                    templateFn = jade.compileClient(templateContent, {
                        inlineRuntimeFunctions: true,
                        compileDebug: opts.debug,
                        pretty: opts.debug,
                        filename: templatePath
                    }),
                    templateString = templateFn.toString(),
                    hash = crypto.createHash("md5");

                if (!opts.debug) {
                    templateString = uglify.minify(templateString, {
                        fromString: true
                    }).code;
                }

                // Hash by file
                hash.update(templateLicense + templateString);
                hash = hash.digest("hex");
                hash = hash.substr(0, opts.hashLength);

                return {
                    hash: hash,
                    name: templateName,
                    string: templateString
                };
            }
        } catch (err) {
            return;
        }
    }

    // Serve static templates
    function middleware (req, res, next) {
        var baseUrl = "template",
            partsUrl = _.drop((req.originalUrl || "").split("/")),
            fileRegexp = new RegExp(outputName + "|\\.jade\\.js$"),
            headers = {
                "Cache-Control": "public, max-age=" + (opts.debug ? 0 : opts.maxAge),
                "Content-Type": "text/javascript"
            };

        if (!(partsUrl[0] === "template" && fileRegexp.test(partsUrl[1]))) {
            return next();
        }

        res.set(headers);

        // Return general templates list
        if (partsUrl[1] === outputName) {
            return res.send(templatesCode);
        }

        // Template compile function
        var nameParts = partsUrl[1].split("."),
            _template = opts.debug ? getTemplate(nameParts[0] + ".jade") : templates[nameParts[0]];

        if (_template && (opts.debug || _template.hash === nameParts[1])) {
            return res.send(templateLicense + _template.string);
        }
        next();

    }

    return middleware;
};


exports.reqTemplate = reqTemplate;
