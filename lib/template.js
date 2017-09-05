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

/**
 * @public
 * Compiles `.jade` templates and saves them in memory with a hash for serve with
 * cache busting technique, the client side can request `template/templates.js`
 * or `template/templates.min.js` if `debugClient ìs `false`
 * for get availables templates
 * @param {string} viewsPath - full path of views
 * @param {object} opts - configuration options
 * - debug: if false return template minified (default: false)
 * - maxAge: max expiration time (default: 5 days)
 * - hashLength: length of caching hash (default: 8)
 * @return {function} Express.js middleware
 */
var reqTemplate = function(viewsPath, opts, log) {
    opts = _.extend({
        debug: false,
        maxAge: 86400 * 5,
        hashLength: 8
    }, opts);

    var templateLicense = "// This file is auto generated and will be overwritten \n" +
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
        "// for the JavaScript code in this page.\n\n",
        // Ignore some unnecessaries templates
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
        // Build templates data
        tplData = loadTemplates(),
        tplListJs = getTemplateListJs(tplData.hashes),
        // Custom validators
        hashRegexp = new RegExp("^[a-f0-9]{" + opts.hashLength + "}$"),
        fileRegexp = new RegExp(tplListJs.name + "|\\.jade\\.js$");


    /**
     * @private
     * Get JS list of available templates
     * @param {array} hashes - hashes of available templates
     * @return {object} JS code and output name of templates list
     */
    function getTemplateListJs (hashes) {
        var outputName = "templates",
            templatesCode = "if (!window.Pump) {window.Pump = {};}" +
            "(function(Pump) {\"use strict\";" +
            " Pump._templates = { " + hashes.join(",") + "};" +
            "})(window.Pump);";

        if (log) {
            log.debug("Build templates list");
        }
        // Compress
        if (!opts.debug) {
            templatesCode = uglify.minify({
                templates: templatesCode
            }).code;
            outputName += ".min";
        }
        // Add license after because uglify remove comments
        return {
            code: templateLicense + templatesCode,
            name: outputName += ".js"
        };
    }

    /**
     * @private
     * Get all files from views directory
     * @return {object} templates code and hashes
     */
    function loadTemplates () {
        var viewsFiles = fs.readdirSync(viewsPath),
            templates = {},
            templatesHashes = [];

        if (log) {
            log.info("Compiling and caching templates");
        }

        _.each(viewsFiles, function(file) {
            var _template = getTemplate(file);
            if (_template) {
                // Add template compile function with hash version
                templates[_template.name] = {
                    hash: _template.hash,
                    code: _template.code
                };
                templatesHashes.push("\"" + _template.name + "\": " + "\"" + _template.hash + "\"");
            }
        });

        return {
            templates: templates,
            hashes: templatesHashes
        };
    }

    /**
     * @private
     * Get file but only take all .jade templates, minify if is not `debug`
     * @param {string} file - full path of view file
     * @return {object} Template data, code, hash and name
     */
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
                    templateCode = templateFn.toString(),
                    hash = crypto.createHash("md5");

                if (!opts.debug) {
                    templateCode = uglify.minify({
                        template: templateCode
                    }).code;
                }

                // Hash by file
                hash.update(templateLicense + templateCode);
                hash = hash.digest("hex");
                hash = hash.substr(0, opts.hashLength);

                if (log) {
                    log.debug("Compile templates %s with hash %s", templateName, hash);
                }

                return {
                    hash: hash,
                    name: templateName,
                    code: templateCode
                };
            }
        } catch (err) {
            if (log) {
                log.warn(err, "Error when get template file: %s", file);
            }
            return;
        }
    }

    /**
     * @public
     * Serve static templates with cache buster
     * @param {object} req - request server
     * @param {object} res - response server
     * @param {function} next - callback
     */
    function middleware (req, res, next) {
        var partsUrl = _.drop((req.originalUrl || "").split("/")),
            pathName = partsUrl[0],
            fileName = partsUrl[1],
            headers = {
                "Cache-Control": "public, max-age=" + (opts.debug ? 0 : opts.maxAge),
                "Content-Type": "text/javascript"
            };

        if (!(pathName === "template" && fileRegexp.test(fileName))) {
            return next();
        }

        res.set(headers);

        // Return general templates list
        if (fileName === tplListJs.name) {
            return res.send(tplListJs.code);
        }

        // Template compile function
        var templates = tplData.templates,
            partsName = _.pull(fileName.split("."), "jade", "js"),
            templateName = partsName[0] || "",
            templateHash = partsName[1] || "",
            _template = opts.debug ? getTemplate(templateName + ".jade") : templates[templateName];

        if (_template && (opts.debug || hashRegexp.test(templateHash))) {
            return res.send(templateLicense + _template.code);
        }
        next();

    }

    return middleware;
};


exports.reqTemplate = reqTemplate;
