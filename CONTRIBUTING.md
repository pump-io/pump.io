# Contribution guide

We're thrilled you're interested in contributing to pump.io! There are lots of ways to get involved - see below for details.

## Code

There's always work to be done on the pump.io codebase. Here are the general rules:

* Write [good commit messages][commits]
* Make sure the linter (`npm run lint`) passes
* Make sure `npm test` passes
* Send patches via Pull Request (or, less preferably, emailed to <alex@strugee.net>)
* See [HACKING.md][] for more guidelines

Need a more detailed explanation, or aren't sure how to start? See [CONTRIBUTING_CODE.md][].

## Issues

Found a problem in pump.io, or want to suggest an improvement? Reporting that to us is super useful.

If you've found a bug, include as much information as possible about the server:

* Hostname
* pump.io version
* Node.js version
* npm version
* The contents of `pump.io.json` (if you have access to that; make sure to redact secrets)
* The operating system
* Install method (source-based or npm-based)

If it's a bug in the web UI, please provide exact step-by-step instructions for reproducing it.

If it's a bug in the API, include details about what you're submitting or the exact URL that you're querying.
