require('source-map-support').install()
const ChromeLauncher = require('lighthouse/lighthouse-cli/chrome-launcher').ChromeLauncher
const CDP            = require('chrome-remote-interface')
const fs             = require('fs')
const async          = require('async')
const Jimp          = require('jimp')

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

module.exports = ChromeJS
