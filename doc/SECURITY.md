<!-- NOTE: don't forget to update the wiki when updating this file! -->

This document is mirrored from [the wiki][] since that can be edited by anyone. It is also GPG-signed by the primary maintainer, AJ Jordan, and all commits that touch this file will be signed as well.

# Reporting security vulnerabilities

Security disclosures can be sent to pumpsecurity@strugee.net (in the future, this will change to security@pump.io). Please do not use GitHub Issues for serious security problems, as there is no way to make a GitHub issue private. Do **not** report security vulnerabilities to any other address, otherwise they won't be routed to the right mailbox and the maintainers may not see them.

# Security support timelines

Should a security problem be discovered, the project will provide patches and new releases for the current stable, the previous stable, and the current beta (if there is one) - this means that the project supports approximately the previous 4 months of releases (see [[Release cycle]] for the exact timing). If there were breaking changes within the previous 6 months, security support will be extended back another release (i.e. the release _before_ the previous stable will receive patches, for a total of 3 supported releases).

The pump.io project _may_ commit to longer support windows for particular releases at our discretion, if you ask nicely. In particular we may be willing to do this to support distribution packaging efforts, although currently (as of January 2017) this is unlikely since there is still a lot of work to do bringing dependencies up-to-date.

There are no plans for LTS releases at this time. In the future we would like to introduce such a system; however, at the moment it's untenable due to the large amount of codebase churn.

 [the wiki]: https://github.com/pump-io/pump.io/wiki/Security
