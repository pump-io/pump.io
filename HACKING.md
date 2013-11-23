# HACKING

Some quick documentation for hackery of pump.io.

## JAVASCRIPT

* [jshint](http://www.jshint.com/) should run without errors.
* [idiomatic.js](https://github.com/rwldrn/idiomatic.js) is about right, with below exceptions.
* 4-character indent, spaces only (no tabs).
* double-quotes for strings.
* No internal space for parentheses; so "if (foo)", not "if ( foo )".
* Use [Step](https://github.com/creationix/step).
* Use [Underscore](http://underscorejs.org/).
* Use [databank](https://github.com/evanp/databank). Don't write to some storage engine's API.
* Use [vows](http://vowsjs.org/).

## LOGGING

* Use [bunyan](https://github.com/trentm/node-bunyan) for logging.
* Use these log levels:
  * `error`: A problem that was not recovered from.
  * `warning`: A problem that was recoverable. Example:
    distribution to a remote user with an invalid address, authentication failure.
  * `info`: Events of interest to system administrators who don't hack the code.
    Data crossing the process boundaries should get a single `info` log item.
    Example: sending an email, delivery of an activity to a remote user, sending
    an activity to the firehose, a Web request.
  * `debug`: Events of interest to developers of pump.io. Example: enter/exit
    a function, before/after a databank search.
* Don't use the log level `trace`.
  
## GENERAL

* Write tests first. Or, at least, soon after.
* Use github issues to track issues.
* Use Markdown for documentation.
