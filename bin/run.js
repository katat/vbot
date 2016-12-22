#! /usr/bin/env node
var shell = require("shelljs");
var argv = require('yargs').argv;
var phantomjs = require('phantomjs');
process.env.PHANTOMJS_EXECUTABLE = phantomjs.path;
shell.exec("$(npm root -g)/vbot/node_modules/casperjs/bin/casperjs test $(npm root -g)/vbot/runner.js --f=" + argv.f);
