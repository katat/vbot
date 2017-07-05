'use strict';
const ChromeJS     = require('chromejs')
const EventEmitter = require('events')
const fs           = require('fs-extra')
const mkdirp       = require('mkdirp')
const Jimp         = require('jimp')
const jsonlint     = require("jsonlint")
const getPort      = require('get-port')

class VBot extends EventEmitter {
  constructor (options = {mismatchThreshold: 0}) {
    super()
    this.options = options
    this.options.imgdir = options.imgdir || `${process.cwd()}/vbot/${this.options.projectFile}`
  }

  async parseSchema (filePath) {
    return new Promise(async (resolve, reject) => {
      let schema;
      try {
        let json = fs.readFileSync(filePath).toString('utf-8')
        schema = jsonlint.parse(json);
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
    } else {
      fs.removeSync(`${imgFolder}/diff`)
      fs.removeSync(`${imgFolder}/test`)
    }
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < scenario.actions.length; i++) {
        let startTime = new Date()
        let action = scenario.actions[i]
        await this.waitAnimation()
        if (action.delay) {
          await this.client.wait(action.delay)
        }
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
        if (['scroll', 'scrollTo'].indexOf(action.type) !== -1) {
          await this.scroll(action)
        }
        if (action.scrollTo) {
          await this.client.eval(`document.querySelector("${action.selector}").scrollIntoView(true)`)
        }
        if (action.type === 'click') {
          await this.click(action).catch((e) => {
            this.emit('action.fail', {
              index: i,
              action: action,
              details: e
            })
          })
        }
        if (['enter', 'typing'].indexOf(action.type) !== -1) {
          await this.type(action)
          if (action.enter) {
            const presses = ['rawKeyDown', 'char', 'keyUp']
            for (let i = 0; i < presses.length; i++) {
              await this.client.client.Input.dispatchKeyEvent({
                "type" : presses[i],
                "windowsVirtualKeyCode" : 13,
                "unmodifiedText" : "\r",
                "text" : "\r"
              })
            }
          }
        }
        if (action.type === 'select') {
          // await this.selectDropdown(action)
        }
        let actionLog = {
          index: i,
          action: action
        }
        if (action.shot) {
          await this.waitAnimation()
          action.captureDelay && await this.client.wait(action.captureDelay)
          let screenshot = await this.capture(action, i, imgFolder).catch((err) => {
            actionLog.screenshot = (typeof err === 'string') ? {err: err} : err
            return
          })
          if (screenshot) {
            actionLog.screenshot = screenshot
          }
        }
        actionLog.duration = new Date() - startTime
        this.emit('action.executed', actionLog)
      }
      resolve()
    })
  }

  async timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async runSchema (schema) {
    for (let i = 0; i < schema.scenarios.length; i ++) {
      let scenario = schema.scenarios[i]
      if (this.options.include && scenario.name.indexOf(this.options.include) === -1) {
        continue
      }
      this.client = new ChromeJS({
        headless: !this.options.showWindow,
        port: await getPort(),
        windowSize: {
          width: schema.viewWidth,
          height: schema.viewHeight
        }
      })
      await this.client.start()
      scenario.url = (this.options.host || schema.host) + scenario.path;
      if (!scenario.url) {
        console.error('no url specified by scenario %s', scenario.name);
      }
      await this.client.goto(scenario.url)
      this.emit('scenario.start', scenario)
      this.client.client.Animation.animationStarted((e) => {
        if (this.animationStartTime) {
          let elapse = new Date() - this.animationStartTime
          let _expectedAnimationDuration = elapse + e.animation.source.duration
          let diff = _expectedAnimationDuration - this.expectedAnimationDuration
          if (diff >= 0) {
            this.expectedAnimationDuration = _expectedAnimationDuration
          }
          return
        }
        this.expectedAnimationDuration = e.animation.source.duration
        this.animationStartTime = new Date()
      })

      await this.runActions(scenario, this.options.rebase).catch((e) => {
        return e
      })
      this.emit('scenario.end')
    }
  }

  async waitAnimation () {
    let wait = true
    return new Promise(async (resolve) => {
      if (!this.animationStartTime || !this.expectedAnimationDuration) {
        return resolve()
      }
      while (wait) {
        await this.client.wait(100)
        let duration = new Date() - this.animationStartTime
        wait = duration - this.expectedAnimationDuration >= 0 ? false : true
      }
      delete this.animationStartTime
      delete this.expectedAnimationDuration
      resolve()
    })
  }

  getScreenshotFileName (action, index) {
    let filename = `${index}_`
    if (action.comment) {
      filename += action.comment.replace(/\s/g, '_')
      return filename
    }
    if (action.selector) {
      filename += `${action.type}-` + action.selector.replace(/\s/g, '_')
      return filename
    }
  }

  async capture (action, stepIndex, folder) {
    return new Promise((resolve, reject) => {
      if (this.options.showWindow) {
        return reject({err: 'Screenshot is disabled when running the tests with a visible Chrome window -- showWindow:true'})
      }
      let filename = this.getScreenshotFileName(action, stepIndex)
      let baseFolder = `${folder}/base`
      let baseFilePath = `${baseFolder}/${filename}.png`
      let files = {
        base: baseFilePath
      }
      if (fs.existsSync(baseFilePath)) {
        let testFolder = `${folder}/test`
        let testFilePath = `${testFolder}/${filename}.png`
        mkdirp(testFolder, async () => {
          await this.client.screenshot(testFilePath, this.client.options.windowSize);
          let diffFolder = `${folder}/diff`
          let diffFilePath = `${diffFolder}/${filename}.png`
          mkdirp(diffFolder, async () => {
            let result = await this.compareImages({baseFilePath, testFilePath, diffFilePath}).catch((err) => {
              console.log(err)
            })
            files.test = testFilePath
            let percentage = parseFloat(result.data.misMatchPercentage)
            if (percentage) {
              files.diff = diffFilePath
            }
            let screenshotResult = {files, analysis: result.data}
            resolve(screenshotResult)
          })
        })
        return
      }
      mkdirp(baseFolder, async () => {
        await this.client.screenshot(baseFilePath, this.client.options.windowSize);
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

  async compareImages (params) {
    let baseFilePath = params.baseFilePath
    let testFilePath = params.testFilePath
    let diffFilePath = params.diffFilePath
    let baseImg = await Jimp.read(baseFilePath)
    let testImg = await Jimp.read(testFilePath)
    let diff = Jimp.diff(baseImg, testImg)
    diff.percent && await diff.image.write(diffFilePath)
    return {
      data: {
        misMatchPercentage: diff.percent,
        isSameDimensions: baseImg.bitmap.width === testImg.bitmap.width && baseImg.bitmap.height === testImg.bitmap.height,
        passThreshold: diff.percent <= this.options.mismatchThreshold
      }
    }
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
    let start = new Date()
    let cond = true
    while (cond) {
      await this.client.wait(action.selector, action.waitTimeout)
      try {
        let box = await this.client.box(action.selector)
        if (box) {
          break
        }
      }catch(e) {
        if (new Date() - start >= (action.waitTimeout || 5000)) {
          throw e
        }
        await this.client.wait(10)
      }
    }
  }

  async start () {
    this.startTime = new Date()
    let schema = await this.parseSchema(this.options.projectFile)
    await this.runSchema(schema);
    this.emit('end', {duration: new Date() - this.startTime})
  }

  async close () {
    if (this.options.showWindow) {
      return
    }
    return new Promise(async (resolve) => {
      this.client && await this.client.close()
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
