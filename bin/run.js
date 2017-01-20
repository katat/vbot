#! /usr/bin/env node
var shell = require("shelljs");
var argv = require('yargs').argv;
var phantomjs = require('phantomjs');
process.env.PHANTOMJS_EXECUTABLE = phantomjs.path;
var cmd = "$(npm root -g)/vbot/node_modules/casperjs/bin/casperjs test $(npm root -g)/vbot/runner.js --f=" + argv.f;
if(argv.rebase) {
    cmd += ' --rebase';
}
if(argv.scenario) {
    cmd += ' --scenario=' + argv.scenario;
}
if(argv.output) {
    cmd += ' --output=' + argv.output;
}
if(argv.imgdir) {
    cmd += ' --imgdir=' + argv.imgdir;
}
if(argv.nf) {
    cmd += ' --nf=' + argv.nf;
}
shell.exec(cmd);
