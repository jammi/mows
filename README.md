MOWS
====

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

MOWS is a data synchronization event engine using nginx, Koa, MongoDB and RabbitMQ.

It's also a project in very early development stages, so pretty much anything is subject to change. One of the things are its name.


LICENSE
-------
[MIT](LICENSE.txt)


INSTALL
-------

First install nginx, mongodb, rabbitmq and nodejs.

Then checkout this repository (later, you'll be ably to just run npm install -g mowsjs).

In the repository root, run this to get dependencies installed in `node_modules/`:

`npm install`


RUNNING TESTS
-------------

`npm test`


CONTRIBUTIONS
-------------

Fork this project on github, then open a pull request on https://github.com/jammi/mows

Write tests for every feature you implement or change. Verify the tests work.

Tests are run by [test/run-tests.js](./test/run-tests.js).

The test configuration in in [test/config.js](./test/run-tests.js).

The spec files are in [test/spec/](./test/spec/); files ending with '-spec.js' are run.

The test data is created and erased, when the test starts. Use ^C at the end of the test run to exit.

To inspect the test data, see the `test-data` directory, which the test runner creates (and erases at the start of the next test run).

To inspect the mongo database of the tests, run `mongo 127.0.0.1:9100/mongotest`. The `sessions` and `values` collections are created and populated by MOWS and should be erased to a clean state in the tests before each `it`.


CREDITS
-------

Everyone who contributed on RSence's server, which is considered the prototype implementation of MOWS.


*Architecture and development:*

- Juha-Jarmo Heinonen [o@rsence.org]
