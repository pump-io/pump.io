# TESTING

Some important stuff for testing the package.

## Test suites

There are a couple test suites available that test this package's
behavior. Here's all of them:

| Suite              | Command                | Description                                   |
| ------------------ | ---------------------- | --------------------------------------------- |
| Default suite      | `npm test`             | Runs all the linters and the main test suite  |
| Main test suite    | `npm run test:vows`    | Runs tests for main application functionality |
| As-root test suite | `npm run test:root`    | See "running as root" below                   |
| System smoketests  | `npm run test:system`  | Runs selected tests from the main suite targeted at a system daemon instead of spinning up an app internally (useful for smoketesting packaging, etc.) |
| Install smoketest  | `npm run test:install` | Runs `npm install -g .` to ensure that the package is actually installable |

In general you don't need to worry about these - the right one will be
run in Travis.

## Running as root

Some of the functionality that this package provides requires
listening on port 80. (Mostly the stuff that requires Webfinger,
Host-Meta, and federation.) Most Unix-like systems require root access
to do that.

It is a bad idea to casually run stuff as root. So, if you run "npm
test", it will only run the tests that don't require root.

To run the root-required tests, do:

    sudo npm run test:root
    
I suggest that if you're doing development and testing the code that
needs root, you should run it in a virtual machine.

## Domain names

Webfinger and Host-Meta require using a domain name. For the unit
tests, I used .localhost domains per
[RFC 2606](http://tools.ietf.org/html/rfc2606). Here are the domains I
use:

* dialback.localhost - for testing dialback

I suggest you use something similar.

## .travis.yml

I use [Travis CI](http://travis-ci.org/) for continuous
integration. It's pretty great.

The .travis.yml file sets up the domain names and runs the root-only tests.
