const assert      = require('assert')
const VBot        = require('../../dist')
const _ = require('lodash')
describe('actions', async () => {
  let vbot
  const fixturePath = `file:///${__dirname}/../fixtures/html`
  const testPath = `${__dirname}`
  let opts = {
    showWindow: process.env.WIN,
    verbose: false,
    imgdir: `${testPath}/../tmp/screenshots`,
    playbook: {
      viewWidth: 375,
      viewHeight: 677
    }
  }
  process.on('unhandledRejection', (e) => {
    console.log(e)
  })
  // beforeEach(function () {
  //   vbot.removeAllListeners('end')
  //   vbot.removeAllListeners('action.fail')
  // });
  afterEach(function (done) {
    vbot.close().then(done)
  });
  describe('click', function () {
    it('should click an element', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/click.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'click', selector: 'button'}
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      vbot.on('end', () => {
        vbot.client.eval(`document.querySelector('button').innerText`).then((data) => {
          assert.equal(data.result.value, 'Clicked')
          done()
        })
      })
    });
  });
  describe('typing', function () {
    it('should type strings in an element', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/typing.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'click', selector: 'input'},
            {type: 'typing', value: 'hello', enter: true}
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      vbot.on('end', () => {
        let promise = vbot.client.eval(`document.querySelector('input').value`).then((data) => {
          assert.equal(data.result.value, 'hello')
        })
        promise = promise.then(() => {
          return vbot.client.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
            assert.equal(data.result.value, 'pressed enter')
          })
        })
        promise.then(done)
      })
    });
  });
  describe('select', function () {
    it('should select an option in a select input', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/select.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'select', selector: 'select', selectIndex: 2},
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      vbot.on('scenario.start', async () => {
        vbot.client.eval('document.querySelector("select").value').then((evalResponse) => {
          assert.equal(evalResponse.result.value, 'selected_1')
        })
      })
      vbot.on('scenario.end', async () => {
        vbot.client.eval('document.querySelector("select").value').then((evalResponse) => {
          assert.equal(evalResponse.result.value, 'selected_2')
          done()
        })
      });
    });
  });
  describe('assert inner text', function () {
    it('should be able to wait and assert if an element has a inner text', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'assertInnerText', selector: '#demo', match: 'see', waitTimeout: 2000}
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      vbot.on('action.fail', (log) => {
        assert.fail(log)
      })
      vbot.on('scenario.end', () => {
        vbot.client.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
          assert.equal(data.result.value, 'can you see me?')
          done()
        })
      })
    });
  });
  describe('scroll', function () {
    it('should scroll using position', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/scroll.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'scroll', selector: '.box', position: [0, 1000], delay: 1000},
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      let top
      vbot.on('scenario.start', () => {
        vbot.client.box('#test').then((box) => {
          top = box.model.content[1]
        })
      })
      vbot.on('end', () => {
        vbot.client.box('#test').then((box) => {
          assert.notEqual(box.model.content[1], top)
          done()
        })
      })
    });
  });
  describe('action failed', function () {
    it('action [exist] should emit action.fail when element not found', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'exist', selector: '#nofound', waitTimeout: 2000}
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      let failed = false
      let executed = false
      vbot.on('action.executed', () => {
        executed = true
      })
      vbot.on('action.fail', (log) => {
        failed = true
      })
      vbot.on('end', () => {
        assert(failed)
        assert(!executed)
        done()
      })
    });
    it('action [assertInnerText] should emit action.fail when element not found', function (done) {
      let options = _.clone(opts)
      _.assign(options.playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenarios:[{
          name: this.test.title,
          actions: [
            {type: 'assertInnerText', selector: '#demo', match: 'no', waitTimeout: 2000}
          ]
        }]
      })
      vbot = new VBot(options)
      vbot.start()
      let failed = false
      let executed = false
      vbot.on('action.executed', () => {
        executed = true
      })
      vbot.on('action.fail', (log) => {
        failed = true
      })
      vbot.on('end', () => {
        assert(failed)
        assert(!executed)
        done()
      })
    });
  });
})
