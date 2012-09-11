# TESTING

Some important stuff for testing the package.

## Running as root

Some of the functionality that this package provides requires
listening on port 80. (Mostly the stuff that requires Webfinger,
Host-Meta, and federation.) Most Unix-like systems require root access
to do that.

It is a bad idea to casually run stuff as root. So, if you run "npm
test", it will only run the tests that don't require root.

To run the root-required tests, do:

    sudo vows test/*-test-as-root.js
    
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



