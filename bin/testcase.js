#!/usr/bin/env node

"use strict";

var fs = require("fs"),
    path = require("path"),
    _ = require("underscore"),
    argv = require("yargs")
           // Hack to make sure that .config()'s callback gets run even if -c isn't specified
           .default("config", "/dev/null", "/etc/pump.io.json\" and \"~/.pump.io.json")
           .config("c", "Configuration file", function findConfig(filename) {
               var files,
                   config = {},
                   i,
                   raw,
                   parsed;

               if (filename !== "/dev/null") {
                   files = [filename];
               } else {
                   files = ["/etc/pump.io.json"];
                   if (process.env.HOME) {
                       files.push(path.join(process.env.HOME, ".pump.io.json"));
                   }
               }

               // This is all sync
               for (i = 0; i < files.length; i++) {
                   try {
                       raw = fs.readFileSync(files[i]);
                   } catch (err) {
                       continue;
                   }

                   try {
                       parsed = JSON.parse(raw);
                       _.extend(config, parsed);
                   } catch (err) {
                       console.error("Error parsing JSON configuration:", err.toString());
                       console.error("Try using a JSON validator.");
                       process.exit(1);
                   }
               }

               return config;
           })
           .help()
           .argv;
