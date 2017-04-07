'use strict'
const shell = require("shelljs");
const phantomjs = require('phantomjs');
const yargs = require('yargs');
process.env.PHANTOMJS_EXECUTABLE = phantomjs.path;

module.exports = function() {
  this.cmdOptions = {
    schema: {
      alias: 'f',
      describe: 'schema file path',
      show: true,
      demand: true
    },
    rebase: {
      alias: 'r',
      describe: 'rebase the screenshots',
      show: true
    },
    nf: {
      alias: 'nf',
      describe: 'a new schema to run tests and compare screenshot results with original schema'
    },
    output: {},
    scenario: {
      alias: 's',
      describe: 'specified scenario to test',
      show: true
    },
    imgdir: {
      alias: 'd',
      describe: 'custom path to save screenshot results',
      show: true
    }
  }

  this.cmd = "$(npm root -g)/vbot/node_modules/casperjs/bin/casperjs test $(npm root -g)/vbot/runner.js"

  this.getCmdStr = function(cmdOptions) {
    Object.keys(this.cmdOptions).forEach((opt) => {
      if(!this.cmdOptions[opt].show) {
        return;
      }
      yargs.option(opt, this.cmdOptions[opt])
    });
    const argv = yargs.argv;
    Object.keys(cmdOptions).forEach((opt) => {
      if (!argv[opt]) {
        return;
      }
      this.cmd += ' --' + opt + '=' + argv[opt];
    });
    return this.cmd
  }

  this.exec = function() {
    let cmdOptions = this.cmdOptions
    let cmd = this.getCmdStr(cmdOptions)
    shell.exec(cmd);
  }

  return this
}
