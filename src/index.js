'use strict';
require('source-map-support').install()

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
const axios        = require('axios')
const ChromeLauncher = require('lighthouse/lighthouse-cli/chrome-launcher').ChromeLauncher
const CDP            = require('chrome-remote-interface')
const async          = require('async')

class ChromeJS {
  constructor(options = {}) {
    const defaults = {
      port: 9222,
      headless: !true,
      windowSize: {},
      additionalChromeFlags: [],
      // waitTimeout: 30000,
      gotoTimeout: 10000,
      // loadTimeout: 30000,
      // evaluateTimeout: 30000,
      // typeInterval: 20
    }
    if (options.windowSize && options.windowSize.width) {
      let width = options.windowSize.width, height = options.windowSize.height
      defaults.additionalChromeFlags.push(`--window-size=${width},${height}`)
    }
    if (options.proxy) {
      defaults.additionalChromeFlags.push(`--proxy-server=${options.proxy}`)
    }
    this.options = Object.assign(defaults, options)
    this.cdpOptions = {
      port: this.options.port
    }
    this.client = null
    this.launcher = null
    // this.messagePrefix = null
    // this.emulateMode = false
    // this.userAgentBeforeEmulate = null
  }

  _createChromeLauncher(options) {
    const flags = []
    flags.push('--disable-gpu')
    if (options.headless) {
      flags.push('--headless')
    }
    if (options.additionalChromeFlags && Array.isArray(options.additionalChromeFlags)) {
      options.additionalChromeFlags.forEach(f => {
        if (f.indexOf('--') === -1) {
          throw new Error('chrome flag must start "--". flag: ' + f)
        }
        flags.push(f)
      })
    }
    return new ChromeLauncher({port: options.port, autoSelectChrome: true, additionalFlags: flags})
  }

  async _waitFinish(timeout, callback) {
    const start = Date.now()
    let finished = false
    let error = null
    let result = null
    const f = async() => {
      try {
        result = await callback.apply()
        finished = true
        return result
      } catch (e) {
        error = e
        finished = true
      }
    }
    f.apply()
    while (!finished) {
      const now = Date.now()
      if ((now - start) > timeout) {
        throw new Error('timeout')
      }
      await this.sleep(50)
    }
    if (error !== null) {
      throw error
    }
    return result
  }

  async start() {
    if (this.client !== null) {
      return
    }
    if (this.launcher === null) {
      this.launcher = this._createChromeLauncher(this.options)
    }
    await this.launcher.run()
    return new Promise((resolve, reject) => {
      const actualCdpOptions = this.cdpOptions
      Object.assign(actualCdpOptions, {
        target: (targets) => {
          return targets.filter(t => t.type === 'page').shift()
        }
      })
      CDP(actualCdpOptions, async(client) => {
        this.client = client
        const {Network, Page, Runtime, Console, Animation} = client
        await Promise.all([Network.enable(), Page.enable(), Runtime.enable(), Console.enable(), Animation.enable()])
        // focuses to first tab
        const targets = await this.client.Target.getTargets()
        const page = targets.targetInfos.filter(t => t.type === 'page').shift()
        await this.client.Target.activateTarget({targetId: page.targetId})

        resolve(this)
      }).on('error', (err) => {
        reject(err)
      })
    })
  }

  async close() {
    if (this.client === null) {
      return false
    }
    await this.client.close()
    this.client = null
    if (this.launcher !== null) {
      await this.launcher.kill()
      this.launcher = null
    }
    return true
  }

  async checkStart() {
    if (this.client === null) {
      await this.start()
    }
  }

  async goto(url, options) {
    const defaultOptions = {
      waitLoadEvent: true
    }
    options = Object.assign(defaultOptions, options)
    await this.checkStart()
    try {
      await this._waitFinish(this.options.gotoTimeout, async() => {
        await this.client.Page.navigate({url: url})
        if (options.waitLoadEvent) {
          await this.client.Page.loadEventFired()
        }
      })
    } catch (e) {
      throw e
    }
  }

  async sleep(ms) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, ms)
    })
  }

  async querySelector(param) {
    if (typeof param === 'number') {
      await this.sleep(param)
    }
    return new Promise(async(resolve, reject) => {
      await this.sleep(50)
      let nodeObj = await this.client.Runtime.evaluate({expression: `document.querySelector('${param}')`})
      if (!nodeObj.result.subtype === 'node') {
        return await this.querySelector(param)
      }
      resolve(nodeObj)
    })
  }

  async box(selector) {
    return new Promise(async(resolve, reject) => {
      let documentNode = await this.client.DOM.getDocument()
      let clickNode = await this.client.DOM.querySelector({nodeId: documentNode.root.nodeId, selector: selector}).catch(reject)
      if (!clickNode) {
        return reject()
      }
      this.client.DOM.getBoxModel({nodeId: clickNode.nodeId}).then(resolve).catch(reject)
    })
  }

  async select(selector,selectIndex){
    selector += " option:nth-child(" + selectIndex + ")"
    let documentNode = await this.client.DOM.getDocument()
    let selectMenu = await this.client.DOM.querySelector({nodeId: documentNode.root.nodeId, selector: selector})
    this.client.DOM.setAttributeValue({nodeId:selectMenu.nodeId,name:"selected",value:"true"})
  }

  async click(selector, x, y) {
    let boxModel = await this.box(selector)
    let centerLeft = Math.floor((x / 2) || boxModel.model.content[0] + (boxModel.model.content[2] - boxModel.model.content[0]) / 2)
    let centerTop = Math.floor((y / 2) || boxModel.model.content[1] + (boxModel.model.content[5] - boxModel.model.content[1]) / 2)
    await this.client.Input.dispatchMouseEvent({type: 'mousePressed', button: 'left', clickCount: 1, x: centerLeft, y: centerTop})
    await this.client.Input.dispatchMouseEvent({type: 'mouseReleased', button: 'left', clickCount: 1, x: centerLeft, y: centerTop})
  }

  async type (value) {
    const characters = value.split('')
    for (let i in characters) {
      const c = characters[i]
      await this.client.Input.dispatchKeyEvent({type: 'char', text: c})
      await this.sleep(20)
    }
  }

  async move(selector, x, y, tx, ty) {

      //depend on getBoundingClientRect()
      let bounding = `document.querySelector('${selector}').getBoundingClientRect()`
      let coordinatesX = `(${bounding}.width / 2) + ${bounding}.left`;
      let coordinatesY = `(${bounding}.height / 2) + ${bounding}.top`;
      let movew = `${coordinatesX} + ${x}`;
      let moveh = `${coordinatesY} + ${y}`;
      let movetw = `${coordinatesX} + ${tx}`;
      let moveth = `${coordinatesY} + ${ty}`;

      //selector center coordinates Relative to Browser
      let coordinatesX_B = `(${bounding}.width / 2) + ${bounding}.left + document.documentElement.scrollLeft`;
      let coordinatesY_B = `(${bounding}.height / 2) + ${bounding}.top  + document.documentElement.scrollTop`;
      let cx_B,cy_B;
      this.eval(coordinatesX_B).then((res) => {
          cx_B = res.result.value
          this.eval(coordinatesY_B).then((res) => {
              cy_B = res.result.value
              console.log('selector center coordinates Relative to Browser: ','(',Math.floor(cx_B),',',Math.floor(cy_B),')');
          })
      })

      //selector center coordinates Relative to Viewport
      let cx,cy;
      this.eval(coordinatesX).then((res) => {
          cx = res.result.value
          this.eval(coordinatesY).then((res) => {
              cy = res.result.value
              console.log('selector center coordinates Relative to Viewport: ','(',Math.floor(cx),',',Math.floor(cy),')');
          })
      })

      let movex,movey,movetx,movety;
      //start_position setting
      this.eval(movew).then((res) => {
          movex = res.result.value;
          movex = parseInt(movex);
          this.eval(moveh).then((res) => {
              movey = res.result.value;
              movey = parseInt(movey);
              console.log('this is start_position: ','(',movex,',',movey,')');
              this.client.Input.dispatchMouseEvent({type: 'mouseMoved',  x: movex, y: movey});
          })
      })

      await this.sleep(1000);

      //end_position setting
      this.eval(movetw).then((res) => {
          movetx = res.result.value;
          movetx = parseInt(movetx);
          this.eval(moveth).then((res) => {
              movety = res.result.value;
              movety = parseInt(movety);
              console.log('this is end_position: ','(',movetx,',',movety,')');
              return this.client.Input.dispatchMouseEvent({type: 'mouseMoved',  x: movetx, y: movety});
          })
      })
  }

  async scroll (selector, y = 0, x = 0) {
    let expr = `document.querySelector('${selector}').scrollTop += ${y}`
    return await this.eval(expr)
  }

  async eval(expr) {
    return new Promise(async (resolve) => {
      resolve(this.client.Runtime.evaluate({expression: `${expr}`}))
    })
  }

  async wait(param, timeout = 5000) {
    if (!param) {
      return
    }
    if (typeof param === 'number') {
      return this.sleep(param)
    }
    return new Promise(async (resolve, reject) => {
      const start = new Date()
      while (true) {
        await this.sleep(10)
        if (new Date() - start >= timeout) {
          return reject(new Error('timeout'))
        }
        let evalResponse = await this.eval(`document.querySelector("${param}")`)
        if (evalResponse.result.subtype === 'node') {
          return resolve(evalResponse)
        }
        if (evalResponse.result.subtype === 'error') {
          return reject(evalResponse)
        }
      }
    })
  }
  async screenshot (filepath, size, format = 'png', quality = undefined, fromSurface = true) {
    return new Promise(async (resolve, reject) => {
      if (['png', 'jpeg'].indexOf(format) === -1) {
        throw new Error('format is invalid.')
      }
      const {data} = await this.client.Page.captureScreenshot({format: format, quality: quality, fromSurface: fromSurface})
      let imgBuf = Buffer.from(data, 'base64')
      let img = await Jimp.read(imgBuf)
      if (size && size.width && size.width !== img.bitmap.width) {
        img.resize(size.width, Jimp.AUTO)
      }
      img.getBuffer(Jimp.MIME_PNG, (err, buf) => {
        if (err) {
          return reject(err)
        }
        if (filepath) {
          img.write(filepath, (err) => {
            if (err) {
              return reject(err)
            }
            resolve(buf)
          })
          return
        }
        resolve(buf)
      });
    })
  }
}

//module.exports = ChromeJS

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

const webRequest = {}

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

  async downloadPlaybook (clientKey, scenarioId) {
    if (!scenarioId || !clientKey) {
      return
    }
    return new Promise ((resolve, reject) => {
      axios({
        method: 'get',
        url: `https://api.vbot.io/scenario/${scenarioId}/playbook`,
        headers: {'x-clientKey': clientKey}
      }).then((res) => {
        return resolve(res.data)
      }).catch((err) => {
        return reject(err)
      })
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
          if (action.type === 'move') {
              await this.move(action).catch((e) => {
                console.log('catch a move error');
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
      this.chromejs.client.Runtime.consoleAPICalled((msg) => {
        for (var i = 0; i < msg.args.length; i++) {
          let arg = msg.args[i]
          let stackTrace = msg.stackTrace.callFrames[0]
          const log = {
            type: msg.type,
            msg: arg.type === 'object' ? 'object' : arg.value,
            url: stackTrace.url,
            line: stackTrace.lineNumber
          }

          this.emit('console', log)
        }
      })
      this.chromejs.client.Network.requestWillBeSent((msg) => {
        webRequest[msg.requestId] = msg
      })
      this.chromejs.client.Network.loadingFailed((msg) => {
        const reqHistory = webRequest[msg.requestId]
        let error = {
          url: reqHistory.documentURL,
          method: reqHistory.request.method,
          error: msg.errorText
        }
        this.emit('network.error', error)
      })
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

      await this.runActions(scenario, this.options.rebase).catch(async (e) => {
        await this.captureResult()

        throw e
      })
      // if (this.options.waitBeforeEnd) {
      //   await this.timeout(this.options.waitBeforeEnd)
      // }

      await this.captureResult()

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
    return new Promise(resolve => {
      const data = {
        data: {
          misMatchPercentage: diff.percent,
          isSameDimensions: baseImg.bitmap.width === testImg.bitmap.width && baseImg.bitmap.height === testImg.bitmap.height,
          passThreshold: diff.percent <= this.options.mismatchThreshold
        }
      }
      if (!diff.percent) {
        return resolve(data)
      }
      diff.image.write(diffFilePath, () => {
        resolve(data)
      })
    })
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
  async move(action) {
   if (!action.selector) {
     throw new Error('move action failed')
    }
   await this.chromejs.move(action.selector, action.start_position[0], action.start_position[1], action.end_position[0], action.end_position[1])
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
          return reject(new Error('No matching inner text is found'))
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
          throw new Error('The first element matching the selector is invisible')
        })
        if (box) {
          break
        }
      }catch(e) {
        if (new Date() - start >= (action.waitTimeout || 5000)) {
          throw e
        }
        await this.chromejs.wait(10)
      }
    }
  }

  async start (playbook, opts) {
    try {
      playbook = playbook || this.options.playbook || this.options.schema
      if (!playbook && this.options.playbookFile) {
        playbook = await this.parsePlaybook(this.options.playbookFile).catch((ex) => {
          this._log('Invalid file path', 'error')
        })
      }
      if (!playbook && this.options.clientKey && this.options.scenarioId) {
        playbook = await this.downloadPlaybook(this.options.clientKey, this.options.scenarioId).catch((err) => {
          this._log('Invalid client key or scenario id', 'error')
        })
        this.options.showWindow = true
      }
      if (!playbook) {
        if (!this.options.playbookFile && !this.options.clientKey && !this.options.scenarioId) {
          this._log('No valid playbook', 'error')
        }
        return
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

  async captureResult () {
    const finishFolder = `${this.getImgFolder()}/finish`
    const finishScreenshot = `${finishFolder}/snapshot.png`
    await this.createFolder(finishFolder)
    console.log('final screenshot', finishScreenshot)
    await this.chromejs.screenshot(finishScreenshot, this.chromejs.options.windowSize);
  }

  _handleEvents () {
    this._log('Starting', 'prompt')

    this.on('scenario.start', (scenario) => {
      this._log(`started scenario: ${scenario.name}`, 'section', 1)
    })

    this.on('console', (log) => {
      this._log(`console: ${log.msg}`, log.type === 'error' ? 'error' : 'input', 1)
    })

    this.on('network.error', (log) => {
      this._log(`network: ${log.url} - ${log.method} - ${log.error}`, 'error', 1)
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
      // delete log.details
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

    // await this._failSnapshot()
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

module.exports = {
    vbot: VBot,
    chromejs: ChromeJS,
}
