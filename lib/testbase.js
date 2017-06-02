'use strict';
const ChromeJS     = require('chromejs')
const EventEmitter = require('events');
const fs           = require('fs')

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

  async runActions (scenario) {
    for (let i = 0; i < scenario.actions.length; i++) {
      let action = scenario.actions[i]
      console.info(`running action for selector:${action.waitFor} index:${i} type:${action.type}`)
      if (action.waitFor) {
        await this.wait(action.waitFor)
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
      if (action.shot) {
        await this.capture(action, i, `${this.options.imgdir}/screenshots/${scenario.name}`)
      }
    }
  }

  async runSchema (schema) {
    schema.scenarios.forEach(async (scenario, index) => {
      await this.client.start()
      this.emit('started')
      scenario.url = (this.options.host || schema.host) + scenario.path;
      if (!scenario.url) {
        console.error('no url specified by scenario %s', scenario.name``);
      }
      await this.client.goto(scenario.url)
      await this.runActions(scenario)
      this.emit('finished')
    });
  }

  async capture (action, stepIndex, folder) {
    await this.client.screenshot(folder + '/' + stepIndex + '_' + action.type + '-' + action.waitFor.replace(' ', '_') + '.png');
  }

  async scroll (action) {
    await this.client.scroll(action.waitFor, action.position[1], action.position[0])
  }

  async type (action) {
    await this.client.type(action.value)
  }

  async click(action) {
    await this.client.click(action.waitFor)
  }

  async wait (action) {
    await this.client.wait(action.waitFor)
  }

  async start () {
    let schema = await this.parseSchema(this.options.projectFile);
    this.client = new ChromeJS({
      headless: !schema.showWindow,
      windowSize: {
        width: schema.viewWidth,
        height: schema.viewHeight
      }
    })
    // this.initPhantomCss(casper, schema);
    // this.listenPageErrors()
    await this.runSchema(schema);
  }

  onStart (cb) {
    cb()
  }

  onFinish (cb) {
    cb()
  }
}

module.exports = VBot
