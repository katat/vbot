'use strict'
require('colors')
const yargs  = require('yargs')
const VBot   = require('./')

module.exports = function() {
  this.cmdOptions = {
    "playbook": {
      alias: 'f',
      type: 'string',
      describe: 'file path for test definitions',
      show: true
    },
    host: {
      alias: 'h',
      type: 'string',
      describe: 'override host target',
      show: true
    },
    rebase: {
      alias: 'r',
      type: 'boolean',
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
    clientKey: {
      show: false
    },
    scenarioId: {
      show: false
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
    yargs
    .command('$0', 'the default command', (yargs) => {
      return yargs.option('f', {demand: true})
    })
    .command('run local file <playbookFile>', 'run vbot test from local json file')
    .command('run local fetch <clientKey> <scenarioId>', 'run vbot test stored in vbot web')
    .command("run", false, (yargs) => {
      return yargs
        .command('local <playbook>', 'run local', (yargs) => {
          yargs
            .command('fetch <clientKey> <scenarioId>')
            .command('file <playbook>')
        })
    })
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
      if (opt === 'clientKey') {
        vbotOpts.clientKey = val
      }
      if (opt === 'scenarioId') {
        vbotOpts.scenarioId = val
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
