'use strict'
require('colors')
const yargs  = require('yargs')
const VBot   = require('./')

module.exports = function() {
  this.cmdOptions = {
    "playbook": {
      alias: 'f',
      describe: 'file path for test definitions',
      show: true,
      demand: true
    },
    host: {
      alias: 'h',
      describe: 'override host target',
      show: true
    },
    rebase: {
      alias: 'r',
      describe: 'rebase the screenshots',
      show: true
    },
    search: {
      alias: 's',
      describe: 'search and only test matched scenarios',
      show: true
    },
    imgdir: {
      describe: 'custom path to save screenshot results',
      show: true
    },
    debug: {
      alias: 'd',
      describe: 'For debugging, make the Chrome window visible and see the tests in action',
      show: true
    },
    web: {
      alias: 'w',
      describe: 'For vbot web user to debug scenario locally using generated id',
      show: true
    }
  }

  this.exec = function () {
    let vbotOpts = {verbose: true}
    Object.keys(this.cmdOptions).forEach((opt) => {
      if(!this.cmdOptions[opt].show) {
        return;
      }
      yargs.option(opt, this.cmdOptions[opt])
    });
    const argv = yargs.argv;
    Object.keys(this.cmdOptions).forEach((opt) => {
      let val = argv[opt]
      if (!val) {
        return;
      }
      if (opt === 'playbook') {
        vbotOpts.playbookFile = val
      }
      if (opt === 'host') {
        vbotOpts.host = val
        let info = '> Override host target with ' + val
        console.info(info.grey)
      }
      if (opt === 'imgdir') {
        vbotOpts.imgdir = val
      }
      if (opt === 'debug') {
        vbotOpts.showWindow = true
      }
      if (opt === 'rebase') {
        vbotOpts.rebase = true
      }
      if (opt === 'include') {
        vbotOpts.include = val
      }
      if (opt === 'web') {
        vbotOpts.web = true
      }
    });
    let vbot = new VBot(vbotOpts)
    vbot.start()
    vbot.on('scenario.end', async () => {
      await vbot.close()
    })
    vbot.on('end', async () => {
      await vbot.close()
      process.exit(0)
    })
    process.on('SIGINT', async () => {
      await vbot.close(true)
      process.exit(1)
    })
    process.on('uncaughtException', function(error) {
      console.log(error)
    })
    process.on('unhandledRejection', function(error) {
      console.log(error)
    })
  }

  return this
}
