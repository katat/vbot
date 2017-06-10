'use strict'
const colors = require('colors/safe')
const yargs  = require('yargs')
const VBot   = require('./testbase')

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
    scenario: {
      alias: 's',
      describe: 'specified scenario to test',
      show: true
    },
    imgdir: {
      alias: 'd',
      describe: 'custom path to save screenshot results',
      show: true
    },
    debug: {
      alias: 'd',
      describe: 'For debugging, make the Chrome window visible and see the tests in action',
      show: true
    }
  }

  colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'green',
    data: 'cyan',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
  });

  this.exec = function () {
    let vbotOpts = {}
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
      if (opt === 'schema') {
        vbotOpts.projectFile = val
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
    });
    let vbot = new VBot(vbotOpts)
    console.info(colors.prompt('> Starting'))
    vbot.start()
    vbot.on('action.executed', (log) => {
      console.info(colors.info(`>> #${log.index+1} executed type:${log.action.type} selector:${log.action.selector}`))
      if (log.screenshot) {
        console.info(colors.data(`>>> screenshot`))
        if (log.screenshot.err) {
          console.error(colors.error(`${log.screenshot.err}`))
        }
        if (log.screenshot.analysis) {
          let analysis = log.screenshot.analysis
          if (analysis.misMatchPercentage) {
            console.info(colors.warn(`>>>> misMatchPercentage: ${analysis.misMatchPercentage*100}%, isSameDimensions: ${analysis.isSameDimensions}, acceptable: ${analysis.acceptable}`))
          } else {
            console.info(colors.data(`>>>> 100% matched`))
          }
        }
      }
    })
    vbot.on('end', async (result) => {
      console.info(colors.prompt(`> Done. Duration: ${result.duration/1000}s`))
      await vbot.close()
      process.exit(0)
    })
    process.on('SIGINT', () => {
      vbot.close()
    })
  }

  return this
}
