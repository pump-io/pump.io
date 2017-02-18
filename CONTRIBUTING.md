# Contribution guide

So you want to contribute to pump.io? We're thrilled to have you!

This guide will help you get started, step-by-step. Please note that
pump.io has a [Code of Conduct][] based on
the [Contributor Covenant][] - participants are expected to adhere to
the rules at all times. (They're not that difficult.)

## Finding an issue

The first step is to find an issue you want to work on. If you came
here because you were annoyed by a bug, that might be a great place to
start! If you're not sure, you can take a look at
the [good first pr][] label to find some bite-sized tasks that are
good introductions to the codebase.

When you've found an issue you want to work on, be sure to comment on
it so that other people know you're working on it.

## Forking and cloning

The next step is to get a copy of pump.io on your computer that you
can use to fix the issue you can get this by [forking the project][].

Then you need to [clone your fork][] of the project. For example, to
clone their personal fork, @octocat might do:

    $ git clone https://github.com/octocat/pump.io
    $ cd pump.io

## Setting up your environment

At this point, if you don't already have it, you'll need to
install [Node.js][].

Once you have Node, you need to install the dependencies that pump.io
needs to run. To do this, run `npm install` and go get a nice cup of
coffee or tea - it might take a while the first time around.

Verify that pump.io can run properly by executing `node bin/pump`. You
should see output similar to the following:

    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18903,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:42.972Z","v":0}
    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18906,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:42.977Z","v":0}
    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18902,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:42.989Z","v":0}
    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18904,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:42.990Z","v":0}
    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18905,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:42.994Z","v":0}
    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18907,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:42.994Z","v":0}
    {"name":"pump.io","hostname":"Alexs-MacBook-Pro","pid":18901,"level":30,"msg":"Listening on 31337 for host 127.0.0.1","time":"2017-02-18T05:50:43.007Z","v":0}

This means that you're ready to fix your issue. If you see an error
message instead of something like the above, something's gone
wrong. You'll have to ask for help.

## Fixing your issue

Now you'll have to find where the code is that needs fixing or
improving. The template files that affect client HTML are in
`public/template`, client JavaScript is in `public/javascript`, and
most server-side code lives in `routes` and `lib`.

If you can't find it, ask for help. The community will be happy to
point you in the right direction.

You'll want to work on your issue in a new branch instead of using
`master`. Name your branch something descriptive, like
`upgrade-express`, `remove-simplesmtp`, or `fix-notification-styles`.

To create a new branch:

    $ git branch fix-notification-styles
    $ git checkout fix-notification-styles

When you commit, be sure to write
a [succinct, properly formatted commit message][commits]. This ensures
that pump.io's git history remains beautiful and useful for everyone.

Note that if you change files in `public/template`, you'll have to run
`npm run build` again to see your changes. Before committing, you
should check your code for style and correctness violations by running
`npm run lint`. You can also run the automated test suite with `npm
test`, but you don't have to since that will take a while and will be
run automatically when you submit your change back to the project.

## Sending a Pull Request

Almost done! The next step is to upload your branch and send a Pull
Request. For example, if you were fixing the notification styles:

    $ git push origin fix-notification-styles

Then, to to your fork on GitHub and [open a Pull Request][] to
pump.io. The last step is to wait for a review and address the review
comments.

Congratulations! Your code's made it into pump.io! Thanks for
contributing - we hope to see you again soon <3

 [Code of Conduct]: https://github.com/pump-io/pump.io/blob/master/CODE_OF_CONDUCT.md
 [Contributor Covenant]: http://contributor-covenant.org/
 [good first pr]: https://github.com/pump-io/pump.io/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+pr%22
 [forking the project]: https://help.github.com/articles/fork-a-repo/
 [clone your fork]: https://help.github.com/articles/cloning-a-repository/
 [Node.js]: https://nodejs.org
 [commits]: http://chris.beams.io/posts/git-commit/
 [open a Pull Request]: https://help.github.com/articles/creating-a-pull-request/
