// template.js
//
// Wrap http/https requests in a callback interface
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

var fs = require("fs"),
    path = require("path"),
    jade = require("jade");

var template = {

    generate: function(viewsPath, log) {
        var viewsFiles = fs.readdirSync(viewsPath);
        var templates = [];

        // Get al files from views directory but only take all .jade files
        viewsFiles.forEach(function(file) {
            var templatePath = path.join(viewsPath, file);
            var stat = fs.lstatSync(templatePath);

            if (stat.isFile() && /\.jade$/.test(file)) {
                var templateName = path.basename(file, ".jade");
                var templateContent = fs.readFileSync(templatePath, {encoding: "utf8"});
                // Compile jade temaple for client side
                var templateFn = jade.compileClient(templateContent, {
                    externalRuntime: false,
                    filename: templatePath
                });
                templates.push("\"" + templateName + "\":  " + templateFn.toString());
            }
        });
        var templatesCode = "// This file is auto generated and will be overwritten \n" +
            "// @licstart  The following is the entire license notice for the \n" +
            "//  JavaScript code in this page.\n" +
            "// \n" +
            "// Copyright 2011-2013, E14N https://e14n.com/\n" +
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
            "// XXX: this needs to be broken up into 3-4 smaller modules \n"+
            "(function() {\"use strict\";" +
            " function pumpTemplates () { return {" + templates.join(",") + "}; } " +
            " window._pumpTemplates = pumpTemplates })();";

        // Save static templates
        fs.writeFile(path.join(viewsPath, "templates.js"), templatesCode, function(err) {
            if (err) {
                log.error(err, "Error on template creation");
                return;
            }
            log.debug("Template compile code save");
        });
    }
};

module.exports = template;
