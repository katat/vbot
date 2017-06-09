'use strict';
const ChromeJS     = require('chromejs')
const ChromeDiff   = require('chromediff')
const EventEmitter = require('events');
const fs           = require('fs-extra')
const mkdirp       = require('mkdirp')

class VBot extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options
  }

  async parseSchema (filePath) {
    return new Promise(async (resolve, reject) => {
      let schema;
      try {
        schema = JSON.parse(fs.readFileSync(filePath));
      } catch (ex) {
        return reject(ex)
      }
      resolve(schema);
    })
  }

  async runActions (scenario, rebase) {
    let imgFolder = `${this.options.imgdir}/${scenario.name}`
    if (rebase) {
      fs.removeSync(imgFolder)
    }
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < scenario.actions.length; i++) {
        let action = scenario.actions[i]
        console.info(`running action index:${i} type:${action.type} selector:${action.selector}`)
        if (action.selector) {
          let waitResult = await this.wait(action).catch((e) => {
            this.emit('action.fail', {
              index: i,
              action: action,
              details: e
            })
            return e
          })
          if (waitResult) {
            return reject(waitResult)
          }
        }
        if (action.type === 'scrollTo') {
          await this.scroll(action)
        }
        if (action.type === 'click') {
          await this.click(action);
        }
        if (action.type === 'enter') {
          await this.type(action)
        }
        if (action.type === 'select') {
          // await this.selectDropdown(action)
        }
        let actionLog = {
          index: i,
          action: action
        }
        if (action.shot) {
          let screenshot = await this.capture(action, i, imgFolder).catch((err) => {
            actionLog.screenshot = {
              err: err
            }
            return
          })
          if (screenshot) {
            actionLog.screenshot = screenshot
          }
        }
        this.emit('action.executed', actionLog)
      }
      resolve()
    })
  }

  async runSchema (schema) {
    schema.scenarios.forEach(async (scenario) => {
      await this.client.start()
      this.emit('start')
      scenario.url = (this.options.host || schema.host) + scenario.path;
      if (!scenario.url) {
        console.error('no url specified by scenario %s', scenario.name``);
      }
      await this.client.goto(scenario.url)
      await this.runActions(scenario, this.options.rebase).catch((e) => {
        return e
      })
      this.emit('end')
    });
  }

  async capture (action, stepIndex, folder) {
    return new Promise((resolve, reject) => {
      if (this.options.showWindow) {
        return reject({err: 'Screenshot is disabled when running the tests with a visible Chrome window -- showWindow:true'})
      }
      let filename = `${stepIndex}_${action.type}-${action.selector.replace(' ', '_')}`
      let baseFolder = `${folder}/base`
      let baseFilePath = `${baseFolder}/${filename}.png`
      let files = {
        base: baseFilePath
      }
      if (fs.existsSync(baseFilePath)) {
        let testFolder = `${folder}/test`
        let testFilePath = `${testFolder}/${filename}.png`
        mkdirp(testFolder, async () => {
          await this.client.screenshot(testFilePath);
          let diffFolder = `${folder}/diff`
          let diffFilePath = `${diffFolder}/${filename}.png`
          mkdirp(diffFolder, async () => {
            let result = await this.chromeDiff.compare({baseFilePath, newFilePath: testFilePath, diffFilePath})
            files.test = testFilePath
            if (parseFloat(result.data.misMatchPercentage)) {
              files.diff = diffFilePath
            }
            let screenshotResult = {files, analysis: result.data}
            resolve(screenshotResult)
          })
        })
        return
      }
      mkdirp(baseFolder, async () => {
        await this.client.screenshot(baseFilePath);
        let files = {
          base: baseFilePath
        }
        let screenshotResult = {
          files: files
        }
        resolve(screenshotResult)
      })
    })
  }

  async scroll (action) {
    await this.client.scroll(action.selector, action.position[1], action.position[0])
  }

  async type (action) {
    await this.client.type(action.value)
  }

  async click(action) {
    await this.client.click(action.selector)
  }

  async wait (action) {
    await this.client.wait(action.selector, action.waitTimeout)
  }

  async start () {
    let schema = await this.parseSchema(this.options.projectFile)
    this.client = new ChromeJS({
      headless: !this.options.showWindow,
      windowSize: {
        width: schema.viewWidth,
        height: schema.viewHeight
      }
    })
    this.chromeDiff = new ChromeDiff()
    // this.initPhantomCss(casper, schema);
    // this.listenPageErrors()
    await this.runSchema(schema);
  }

  async close () {
    return new Promise(async (resolve) => {
      this.client && await this.client.close()
      this.chromeDiff && await this.chromeDiff.close()
      resolve()
    })
  }

  onStart (cb) {
    cb()
  }

  onFinish (cb) {
    cb()
  }
}

module.exports = VBot
