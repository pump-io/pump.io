# Contribution guide

We're thrilled you're interested in contributing to pump.io! There are lots of ways to get involved - see below for details.

## Code

There's always work to be done on the pump.io codebase. Here are the general rules:

* Write [good commit messages][commits]
* Make sure the linter (`npm run lint`) passes
* Make sure `npm test` passes
* Send patches via Pull Request (or, less preferably, emailed to <alex@strugee.net>)
* See [HACKING.md][] for more guidelines

Please be aware that you need npm 5 to work on pump.io.

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

## Hosting

Running a public pump.io node (or even a private one for yourself) is a great way to contribute to the project.

If this sounds interesting you, check out our [sysadmin documentation][], and feel free to get in touch with the [community][] if you run into any problems.

## Developer Certificate of Origin

By contributing code or issues to pump.io, you're implicitly agreeing to the [Developer Certificate of Origin][DCO]:

```
By contributing to the pump.io code base, you make the following
certification according to the Developer Certificate of Origin 1.1.

Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

 [commits]: https://chris.beams.io/posts/git-commit/
 [CONTRIBUTING_CODE.md]: https://github.com/pump-io/pump.io/blob/master/doc/CONTRIBUTING_CODE.md
 [HACKING.md]: https://github.com/pump-io/pump.io/blob/master/HACKING.md
 [sysadmin documentation]: https://pumpio.readthedocs.io/en/latest/sysadmins.html
 [community]: https://github.com/pump-io/pump.io/wiki/Community
 [DCO]: https://developercertificate.org/
