'use strict';
require('source-map-support').install()

const ChromeJS     = require('chromejs')
const fs           = require('fs-extra')
const mkdirp       = require('mkdirp')
const Jimp         = require('jimp')
const jsonlint     = require("jsonlint")
const getPort      = require('get-port')
const chalk        = require('chalk')
const _            = require('lodash')
const Ajv          = require('ajv')
const URL          = require('url')
const EventEmitter = require('events')

const colors = {
  silly: 'rainbow',
  input: 'grey',
  verbose: 'hex("#55dbbe")',
  prompt: 'underline.bold',
  info: 'hex("#9fca56")',
  data: 'hex("#55dbbe").bold',
  help: 'cyan',
  warn: 'hex("#e6cd69")',
  section: 'hex("#43a5d5")',
  error: 'hex("#Cd3f45")'
}

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
      // imgdir : `${process.cwd()}/vbot/${options.playbookFile}`,
      verbose : true,
      showWindow : process.env.WIN
    }
    this.options = _.assign(defaultOpts, options)
  }

  getSchema (schema) {
    return require(`../src/schema/${schema}.json`)
  }

  validatePlaybookSchema(json) {
    var schemas = {
      playbook: this.getSchema('playbook')
    }

    let ajv = new Ajv({useDefaults: true, allErrors: true, $data: true});
    require('ajv-keywords')(ajv, 'select')
    let valid = ajv.validate(schemas.playbook, json)
    return {valid, errors: ajv.errors}
  }

  convertPlaybookSchema(playbook) {
    let url = URL.parse(playbook.url)
    let host = `${url.protocol}//${url.auth?url.auth:''}${url.host}`
    return {
      host: host,
      name: url.host,
      viewWidth: playbook.size.width,
      viewHeight: playbook.size.height,
      scenarios: [
        {
          name: playbook.scenario,
          path: playbook.url.replace(host, ''),
          actions: playbook.actions
        }
      ]
    }
  }

  async parsePlaybook (filePath) {
    if (!filePath) {
      return
    }
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
    let imgFolder = this.getImgFolder(scenario.name)
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
            await this.chromejs.wait(action.delay).catch((e) => {
              log = {index: i, action: action, details: e}
              throw e
            })
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
                  "code": "Enter",
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
        },
        proxy: this.options.proxy
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

  getFolderPath (folder, type) {
    return `${folder}/${type}`
  }

  getFilePath (folder, filename) {
    return `${folder}/${filename}.png`
  }

  getImgFolder (scenarioName) {
    return `${this.options.imgdir}/${scenarioName}`
  }

  async createFolder (path) {
    return new Promise((resolve) => {
      mkdirp(path, () => {
        return resolve()
      })
    })
  }

  async createBaseImg(baseFolder, baseFilePath) {
    return new Promise(async (resolve) => {
      await this.createFolder(baseFolder)
      await this.chromejs.screenshot(baseFilePath, this.chromejs.options.windowSize);
      let files = {
        base: baseFilePath
      }
      let screenshotResult = {
        files: files
      }
      resolve(screenshotResult)
    })
  }

  async screenshotBaseImg(rootFolder, action, stepIndex) {
    let filename = this.getScreenshotFileName(action, stepIndex)
    let baseFolder = this.getFolderPath(rootFolder, 'base')
    let baseFilePath = this.getFilePath(baseFolder, filename)

    return this.createBaseImg(baseFolder, baseFilePath)
  }

  async capture (action, stepIndex, folder) {
    if (this.options.showWindow) {
      this._log('Screenshot is disabled when running the tests with a visible Chrome window -- showWindow:true', 'warn', 4)
      return
    }
    let filename = this.getScreenshotFileName(action, stepIndex)
    let baseFolder = this.getFolderPath(folder, 'base')
    let baseFilePath = this.getFilePath(baseFolder, filename)
    let files = {
      base: baseFilePath
    }
    if (fs.existsSync(baseFilePath)) {
      let testFolder = this.getFolderPath(folder, 'test')
      let testFilePath = this.getFilePath(testFolder, filename)
      await this.createFolder(testFolder)
      await this.chromejs.screenshot(testFilePath, this.chromejs.options.windowSize);
      let diffFolder = this.getFolderPath(folder, 'diff')
      let diffFilePath = this.getFilePath(diffFolder, filename)

      await this.createFolder(diffFolder)
      let result = await this.compareImages({baseFilePath, testFilePath, diffFilePath}).catch((err) => {
        console.log(err)
      })
      files.test = testFilePath
      let percentage = parseFloat(result.data.misMatchPercentage)
      if (percentage) {
        files.diff = diffFilePath
      }
      let screenshotResult = {files, analysis: result.data}
      return screenshotResult
    }
    let screenshotResult = await this.screenshotBaseImg(folder, action, stepIndex)
    return screenshotResult
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

  async start (playbook, opts) {
    try {
      playbook = playbook || this.options.playbook || this.options.schema || await this.parsePlaybook(this.options.playbookFile).catch((ex) => {
        throw ex
      })
      if (!playbook) {
        throw new Error('no playbook found in the options')
      }
      //if not using scenario-list based schema, then validate the playbook
      if (!playbook.scenarios) {
        let validation = this.validatePlaybookSchema(playbook)
        if (!validation.valid) {
          let errText = ''
          validation.errors.forEach((err) => {
            errText += `\n${err.dataPath} ${err.message}: ${JSON.stringify(err.params)}\n`
          })
          throw new Error(errText)
        }
        //convert individual scenario playbook schema to scenario-list based schema
        playbook = this.convertPlaybookSchema(playbook)
      }

      this.options.playbook = playbook
      this.options = _.assign(this.options, opts)
      this.options.imgdir = this.options.imgdir || `${process.cwd()}/vbot/${playbook.name}`

      this.startTime = new Date()
      this._onStart()
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
    this._log('Starting', 'prompt')

    this.on('scenario.start', (scenario) => {
      this._log(`started scenario: ${scenario.name}`, 'section', 1)
    })

    let playbookSchema = this.getSchema('playbook')
    this.on('action.executed', (log) => {
      let actionType = _.get(log, 'action.type')
      this._log(`#${log.index+1} executed type:${actionType}`, 'info', 2)
      let properties = _.get(playbookSchema, `properties.actions.items.selectCases.${actionType}.properties`)
      if (properties) {
        let propNames = Object.keys(properties)
        let propStrings = propNames.map((prop) => {
          if (!properties[prop].type) {
            return
          }
          return `${prop}:${log.action[prop]}`
        }).filter(str => {return str}).join(', ')
        this._log(`${propStrings}`, 'info', 3)
      }
      this._log(`duration:${log.duration/1000}s`, 'data', 3)
      if (log.screenshot) {
        this._log(`screenshot`, 'data', 4)
        if (log.screenshot.err) {
          this._log(`${log.screenshot.err}`, 'error')
        }
        if (log.screenshot.analysis) {
          let analysis = log.screenshot.analysis
          if (analysis.misMatchPercentage) {
            this._log(`misMatchPercentage: ${analysis.misMatchPercentage*100}%, isSameDimensions: ${analysis.isSameDimensions}, acceptable: ${analysis.acceptable}`, 'warn', 4)
            this._log(`diff: ${log.screenshot.files.diff}`, 'warn', 4)
          } else {
            this._log(`100% matched`, 'data', 4)
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
      this._log(`DONE. duration: ${result.duration/1000}s`, 'prompt')
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
    }
    this._log(msg, 'error')

    await this._failSnapshot()
    this.idleClientList.push(this.chromejs)
  }

  _onFinish (cb) {
    cb()
  }

  _log (text, type, level) {
    if(!this.options.verbose && type !== 'error') {
      return
    }
    let string = chalk`{${colors[type]} ${text}}`
    if (level) {
      let levelMark = ''
      for(let i = 0; i < level; i++) {
        levelMark += ' '
      }
      // string = chalk`{bg${colors[type].replace(/(^|\s)[a-z]/g, (str) => str.toUpperCase())} ${levelMark}} ` + string
      string = `${levelMark}` + string
    }
    console.log(string)
  }

  async _failSnapshot () {
    if (!this.chromejs) {
      return
    }
    let failFolder = `${this.imgFolder}/fail`
    await this.createFolder(failFolder)
    await this.chromejs.screenshot(`${failFolder}/snapshot.png`, this.chromejs.options.windowSize);

    // return new Promise((resolve) => {
    //   mkdirp(failFolder, async () => {
    //     resolve()
    //   })
    // })
  }
}

module.exports = VBot
