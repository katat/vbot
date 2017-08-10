const assert      = require('assert')
const VBot        = require('../../dist')
const _ = require('lodash')

process.on('unhandledRejection', (e) => {
  console.log(e)
})

describe('actions', async () => {
  let vbot
  const fixturePath = `file:///${__dirname}/../fixtures/html`
  const testPath = `${__dirname}`
  let playbook = {
    size: {width: 375, height: 677}
  }
  let opts = {
    showWindow: process.env.WIN,
    verbose: false,
    imgdir: `${testPath}/../tmp/screenshots`,
    playbook: playbook
  }
  beforeEach(function () {
    vbot = new VBot(opts)
  });
  afterEach(function (done) {
    vbot.close().then(done)
  });
  describe('click', function () {
    it('should click an element', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/click.html`,
        scenario: this.test.title,
        actions: [
          {type: 'click', selector: 'button'}
        ]
      })
      vbot.start(playbook)
      vbot.on('end', () => {
        vbot.chromejs.eval(`document.querySelector('button').innerText`).then((data) => {
          assert.equal(data.result.value, 'Clicked')
          done()
        })
      })
    });
  });
  describe('typing', function () {
    it('should type strings in an element', function (done) {
      _.assign(playbook,{
        url: `${fixturePath}/typing.html`,
        scenario: this.test.title,
        actions: [
          {type: 'click', selector: 'input'},
          {type: 'typing', value: 'hello', enter: true}
        ]
      })
      vbot.start(playbook)
      vbot.on('end', () => {
        let promise = vbot.chromejs.eval(`document.querySelector('input').value`).then((data) => {
          assert.equal(data.result.value, 'hello')
        })
        promise = promise.then(() => {
          return vbot.chromejs.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
            assert.equal(data.result.value, 'pressed enter')
          })
        })
        promise.then(done)
      })
    });
  });
  describe('select', function () {
    it('should select an option in a select input', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/select.html`,
        scenario: this.test.title,
        actions: [
          {type: 'select', selector: 'select', selectIndex: 2},
        ]
      })
      vbot.start(playbook)
      vbot.on('scenario.start', async () => {
        vbot.chromejs.eval('document.querySelector("select").value').then((evalResponse) => {
          assert.equal(evalResponse.result.value, 'selected_1')
        })
      })
      vbot.on('scenario.end', async () => {
        vbot.chromejs.eval('document.querySelector("select").value').then((evalResponse) => {
          assert.equal(evalResponse.result.value, 'selected_2')
          done()
        })
      });
    });
  });
  describe('assert inner text', function () {
    it('should be able to wait and assert if an element has a inner text', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenario: this.test.title,
        actions: [
          {type: 'assertInnerText', selector: '#demo', match: 'see', waitTimeout: 2000}
        ]
      })
      vbot.start(playbook)
      vbot.on('action.fail', (log) => {
        assert.fail(log)
      })
      vbot.on('scenario.end', () => {
        vbot.chromejs.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
          assert.equal(data.result.value, 'can you see me?')
          done()
        })
      })
    });
    it('timeout assert inner text', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenario: this.test.title,
        actions: [
          {type: 'assertInnerText', selector: '#demo', match: 'see', waitTimeout: 500}
        ]
      })
      vbot.start(playbook)
      let failed = false
      vbot.on('action.fail', () => {
        failed = true
      })
      vbot.on('end', () => {
        assert(failed)
        done()
      })
    });
  });
  describe('scroll', function () {
    it('should scroll using position', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/scroll.html`,
        scenario: this.test.title,
        actions: [
          {type: 'scroll', selector: '.box', position: [0, 1000], delay: 1000},
        ]
      })
      vbot.start(playbook)
      let top
      vbot.on('scenario.start', () => {
        vbot.chromejs.box('#test').then((box) => {
          top = box.model.content[1]
        })
      })
      vbot.on('end', () => {
        vbot.chromejs.box('#test').then((box) => {
          assert.notEqual(box.model.content[1], top)
          done()
        })
      })
    });
  });
  describe('reload', function () {
    it('should reload the page', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/typing.html`,
        scenario: this.test.title,
        actions: [
          {type: 'click', selector: 'input'},
          {type: 'typing', value: 'hello', enter: true},
          {type: 'reload'}
        ]
      })
      vbot.start(playbook)
      vbot.on('end', () => {
        let promise = vbot.chromejs.eval(`document.querySelector('input').value`).then((data) => {
          assert.equal(data.result.value, '')
        })
        promise = promise.then(() => {
          return vbot.chromejs.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
            assert.equal(data.result.value, '')
          })
        })
        promise.then(done)
      })
    });
  });
  describe('action failed', function () {
    it('action [exist] should emit action.fail when element not found', function (done) {
      _.assign(playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenario: this.test.title,
        actions: [
          {type: 'exist', selector: '#nofound', waitTimeout: 2000}
        ]
      })
      vbot.start(playbook)
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
      _.assign(playbook, {
        url: `${fixturePath}/assertInnerText.html`,
        scenario: this.test.title,
        actions: [
          {type: 'assertInnerText', selector: '#demo', match: 'no', waitTimeout: 2000}
        ]
      })
      vbot.start(playbook)
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
