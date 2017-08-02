'use strict';
require('source-map-support').install()

const ChromeJS     = require('chromejs')
const EventEmitter = require('events')
const fs           = require('fs-extra')
const mkdirp       = require('mkdirp')
const Jimp         = require('jimp')
const jsonlint     = require("jsonlint")
const getPort      = require('get-port')
const colors       = require('colors/safe')
const _            = require('lodash')

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'cyan',
  help: 'cyan',
  warn: 'yellow',
  section: 'blue',
  error: 'red'
});

class VBot extends EventEmitter {
  constructor (options) {
    super()
    this.setOptions(options)
    this.idleClientList = []
  }

  setOptions (options = {}) {
    let defaultOpts = {
      mismatchThreshold : 0,
      waitAnimation : true,
      waitBeforeEnd : 1000,
      imgdir : `${process.cwd()}/vbot/${options.playbookFile}`,
      verbose : true,
      showWindow : process.env.WIN
    }
    this.options = _.assign(defaultOpts, options)
  }

  async parsePlaybook (filePath) {
    return new Promise(async (resolve, reject) => {
      let playbook;
      try {
        let json = fs.readFileSync(filePath).toString('utf-8')
        playbook = jsonlint.parse(json);
      } catch (ex) {
        return reject(ex)
      }
      resolve(playbook);
    })
  }

  async runActions (scenario, rebase) {
    let imgFolder = `${this.options.imgdir}/${scenario.name}`
    this.imgFolder = imgFolder
    if (rebase) {
      fs.removeSync(imgFolder)
    } else {
      fs.removeSync(`${imgFolder}/diff`)
      fs.removeSync(`${imgFolder}/test`)
      fs.removeSync(`${imgFolder}/fail`)
    }
    return new Promise(async (resolve, reject) => {
      let log
      try {
        for (let i = 0; i < scenario.actions.length; i++) {
          let startTime = new Date()
          let action = scenario.actions[i]
          await this.waitAnimation()
          if (action.delay) {
            await this.chromejs.wait(action.delay)
          }
          if (action.type === 'reload') {
            await this.reload()
            //need to delay to avoid error from chrome remote interface
            await this.chromejs.wait(100)
          }
          if (action.selector) {
            let waitResult = await this.wait(action).catch((e) => {
              log = {index: i, action: action, details: e}
              throw e
            })
          }
          if (['scroll', 'scrollTo'].indexOf(action.type) !== -1) {
            await this.scroll(action)
          }
          if (action.scrollTo) {
            await this.chromejs.eval(`document.querySelector("${action.selector}").scrollIntoView(true)`)
          }
          if (action.type === 'click') {
            await this.click(action).catch((e) => {
              log = {index: i, action: action, details: e}
              throw e
            })
          }
          if (['enter', 'typing'].indexOf(action.type) !== -1) {
            await this.type(action)
            if (action.enter) {
              const presses = ['rawKeyDown', 'char', 'keyUp']
              for (let i = 0; i < presses.length; i++) {
                await this.chromejs.client.Input.dispatchKeyEvent({
                  "type" : presses[i],
                  "windowsVirtualKeyCode" : 13,
                  "unmodifiedText" : "\r",
                  "text" : "\r"
                })
              }
            }
            if (action.tab) {
              const presses = ['rawKeyDown', 'char', 'keyUp']
              for (let i = 0; i < presses.length; i++) {
                await this.chromejs.client.Input.dispatchKeyEvent({
                  "type" : presses[i],
                  "windowsVirtualKeyCode" : 9,
                  "key": "Tab",
                  "unmodifiedText" : "\t",
                  "text" : "\t"
                })
              }
            }
          }
          if (action.type === 'select') {
            await this.selectDropdown(action)
          }
          if (action.type === 'assertInnerText') {
            await this.assertInnerText(action).catch((e) => {
              log = {index: i, action: action, details: e}
              throw e
            })
          }
          let actionLog = {
            index: i,
            action: action
          }
          if (action.shot || action.screenshot) {
            await this.waitAnimation()
            action.captureDelay && await this.chromejs.wait(action.captureDelay)
            let screenshot = await this.capture(action, i, imgFolder).catch((err) => {
              actionLog.screenshot = (typeof err === 'string') ? {err: err} : err
              return
            })
            if (screenshot) {
              actionLog.screenshot = screenshot
              if (_.get(screenshot, 'analysis.misMatchPercentage') > 0) {
                this.emit('screenshot.diff', actionLog)
              }
            }
          }
          actionLog.duration = new Date() - startTime
          this.emit('action.executed', actionLog)
        }
      } catch (ex) {
        this.emit('action.fail', log)
        return reject(ex)
      }
      resolve()
    })
  }

  async timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async runPlaybook (playbook) {
    if (!playbook.scenarios) {
      throw new Error('scenarios array should be defined')
    }
    for (let i = 0; i < playbook.scenarios.length; i ++) {
      let scenario = playbook.scenarios[i]
      if (this.options.include && scenario.name.indexOf(this.options.include) === -1) {
        continue
      }
      scenario.url = (this.options.host || this.options.url || playbook.url || playbook.host)
      if (scenario.path) {
        scenario.url = scenario.url + scenario.path;
      }
      this.chromejs = new ChromeJS({
        headless: !this.options.showWindow,
        port: await getPort(),
        windowSize: {
          width: parseInt(playbook.viewWidth),
          height: parseInt(playbook.viewHeight)
        }
      })
      await this.chromejs.start()
      await this.chromejs.goto(scenario.url).catch((ex) => {
        throw new Error(ex.message + '; URL: ' + scenario.url)
      })
      this.emit('scenario.start', scenario)
      this.chromejs.client.Animation.animationStarted((e) => {
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
        throw e
      })
      // if (this.options.waitBeforeEnd) {
      //   await this.timeout(this.options.waitBeforeEnd)
      // }
      this.idleClientList.push(this.chromejs)
      this.emit('scenario.end', scenario)
    }
  }

  async waitAnimation () {
    if (!this.options.waitAnimation) {
      return
    }
    let wait = true
    return new Promise(async (resolve) => {
      if (!this.animationStartTime || !this.expectedAnimationDuration) {
        return resolve()
      }
      while (wait) {
        await this.chromejs.wait(100)
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
    return filename
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
          await this.chromejs.screenshot(testFilePath, this.chromejs.options.windowSize);
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
        await this.chromejs.screenshot(baseFilePath, this.chromejs.options.windowSize);
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
    await this.chromejs.scroll(action.selector, action.position[1], action.position[0])
  }

  async type (action) {
    await this.chromejs.type(action.value)
  }

  async click(action) {
    if (!action.selector) {
      throw new Error('click action should have selector attribute')
    }
    await this.chromejs.click(action.selector)
  }

  async selectDropdown(action) {
    await this.chromejs.select(action.selector, action.selectIndex)
  }

  async assertInnerText(action) {
    let expr = `document.querySelector('${action.selector}').innerText`
    let regx = new RegExp(action.match)
    let nodeText = await this.chromejs.eval(expr)
    let result = {}
    let start = new Date()
    let timeout = action.waitTimeout || 5000
    return new Promise (async (resolve,reject) => {
      while (true) {
        await this.timeout(10)
        if (new Date() - start >= timeout) {
          return reject(new Error('timeout'))
        }
        nodeText = await this.chromejs.eval(expr)
        result.nodeText = nodeText.result.value
        result.compareResult = regx.exec(nodeText.result.value)
        if(result.compareResult) {
          return resolve(result)
        }
      }
    })
  }

  async reload() {
    await this.chromejs.client.Page.reload({ignoreCache: true})
  }

  async wait (action) {
    let start = new Date()
    let cond = true
    while (cond) {
      // await this.chromejs.wait(action.selector, action.waitTimeout).catch((ex) => {
      //   console.log('', ex)
      // })
      try {
        let box = await this.chromejs.box(action.selector).catch((ex) => {
          throw new Error('not found dom element')
        })
        if (box) {
          break
        }
      }catch(e) {
        if (new Date() - start >= (action.waitTimeout || 5000)) {
          throw new Error('timeout')
        }
        await this.chromejs.wait(10)
      }
    }
  }

  async start (playbook) {
    if (playbook) {
      this.options.playbook = playbook
    }
    this.startTime = new Date()
    try {
      this._onStart()
      let playbook = this.options.playbook || this.options.schema || await this.parsePlaybook(this.options.playbookFile).catch(() => {
        return null
      })
      if (!playbook) {
        throw new Error('no playbook found in the options')
      }
      if (!playbook.host && !playbook.url && !this.options.host && !this.options.url) {
        throw new Error('no host value found in the playbook')
      }
      await this.runPlaybook(playbook).catch((ex) => {
        throw ex
      })
    } catch (ex) {
      await this._onError(ex)
    }
    this.emit('end', {duration: new Date() - this.startTime})
    return this
  }

  async close (force) {
    if (this.options.showWindow && !force) {
      return
    }
    return new Promise(async (resolve) => {
      for (var i = 0; i < this.idleClientList.length; i++) {
        await this.idleClientList[i].close()
      }
      resolve()
    })
  }

  _handleEvents () {
    this._log('> Starting', 'prompt')

    this.on('scenario.start', (scenario) => {
      this._log(`> started scenario: ${scenario.name}`, 'section')
    })

    this.on('action.executed', (log) => {
      this._log(`>> #${log.index+1} executed type:${log.action.type} selector:${log.action.selector}`, 'info')
      this._log(`>>> duration:${log.duration/1000}s`, 'data')
      if (log.screenshot) {
        this._log(`>>>> screenshot`, 'data')
        if (log.screenshot.err) {
          this._log(`${log.screenshot.err}`, 'error')
        }
        if (log.screenshot.analysis) {
          let analysis = log.screenshot.analysis
          if (analysis.misMatchPercentage) {
            this._log(`>>>> misMatchPercentage: ${analysis.misMatchPercentage*100}%, isSameDimensions: ${analysis.isSameDimensions}, acceptable: ${analysis.acceptable}`, 'warn')
            this._log(`>>>> diff: ${log.screenshot.files.diff}`, 'warn')
          } else {
            this._log(`>>>> 100% matched`, 'data')
          }
        }
      }
    })

    this.on('action.fail', async (log) => {
      const details = log.details
      delete log.details
      this._log(details + '\n' + JSON.stringify(log, undefined, 2), 'error')
    })

    this.on('end', async (result) => {
      this._log(`> DONE. duration: ${result.duration/1000}s`, 'prompt')
    })
  }

  _onStart () {
    if (!this.initedLogEvents) {
      this._handleEvents()
      this.initedLogEvents = true
    }
  }

  async _onError(err) {
    let msg = err.message
    if (process.env.DEBUG) {
      msg += '\n' + err.stack
      this._log(msg, 'error')
    }

    await this._failSnapshot()
    this.idleClientList.push(this.chromejs)
  }

  _onFinish (cb) {
    cb()
  }

  _log (text, type) {
    if(!this.options.verbose) {
      return
    }
    console.log(colors[type](text))
  }

  async _failSnapshot () {
    return new Promise((resolve) => {
      let failFolder = `${this.imgFolder}/fail`
      mkdirp(failFolder, async () => {
        await this.chromejs.screenshot(
          `${failFolder}/snapshot.png`,
          this.chromejs.options.windowSize
        );
        resolve()
      })
    })
  }
}

module.exports = VBot
