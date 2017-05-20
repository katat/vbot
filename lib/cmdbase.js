'use strict'
const shell = require("shelljs");
const phantomjs = require('phantomjs');
const yargs = require('yargs');
const getInstalledPath = require('get-installed-path');
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

  this.getCmdStr = function(cmdOptions, callback) {
    getInstalledPath('vbot').then((vbotPath) => {
      console.log(vbotPath)
      let cmd = vbotPath + "/node_modules/casperjs/bin/casperjs test " + vbotPath + "/runner.js";
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
        cmd += ' --' + opt + '=' + argv[opt];
      });
      callback(cmd)
    })
  }

  this.exec = function() {
    let cmdOptions = this.cmdOptions
    this.getCmdStr(cmdOptions, (cmd) => {
      shell.exec(cmd);
    })
  }

  return this
}
