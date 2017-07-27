const assert      = require('assert')
const VBot        = require('../../dist')
const _ = require('lodash')
describe('actions', async () => {
  const vbot = new VBot()
  const fixturePath = `file:///${__dirname}/../fixtures/html`
  let basePlaybookOpts = {
    "viewWidth": 375,
    "viewHeight": 677,
    "showWindow": process.env.WIN,
  }
  beforeEach(function () {
    vbot.removeAllListeners('end')
  });
  afterEach(function (done) {
    vbot.close().then(done)
  });
  describe('click', () => {
    it('should click an element', (done) => {
      let playbookOpts = _.assign(basePlaybookOpts, {
        url: `${fixturePath}/click.html`,
        scenarios:[{
          actions: [
            {type: 'click', selector: 'button'}
          ]
        }]
      })
      vbot.start({
        playbook: playbookOpts
      })
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
      let playbookOpts = _.assign(basePlaybookOpts, {
        url: `${fixturePath}/typing.html`,
        scenarios:[{
          actions: [
            {type: 'click', selector: 'input'},
            {type: 'typing', value: 'hello', enter: true}
          ]
        }]
      })
      vbot.start({
        playbook: playbookOpts
      })
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
      let playbookOpts = _.assign(basePlaybookOpts, {
        url: `${fixturePath}/select.html`,
        scenarios:[{
          actions: [
            {type: 'select', selector: 'select', selectIndex: 2},
          ]
        }]
      })
      vbot.start({
        playbook: playbookOpts
      })
      vbot.on('end', () => {
        vbot.client.eval(`document.querySelector('select').value`).then((data) => {
          assert.equal(data.result.value, 'selected_2')
          done()
        })
      })
    });
  });
  describe('assert inner text', function () {
    it('should be able to wait and assert if an element has a inner text', function (done) {
      let playbookOpts = _.assign(basePlaybookOpts, {
        url: `${fixturePath}/assertInnerText.html`,
        scenarios:[{
          actions: [
            {type: 'assertInnerText', selector: '#demo', match: 'see', waitTimeout: 2000}
          ]
        }]
      })
      vbot.start({
        playbook: playbookOpts
      })
      vbot.on('action.fail', (log) => {
        assert.fail(log)
      })
      vbot.on('end', () => {
        vbot.client.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
          assert.equal(data.result.value, 'can you see me?')
          done()
        })
      })
    });
  });
  describe('scroll', function () {
    it('should scroll using position', function (done) {
      let playbookOpts = _.assign(basePlaybookOpts, {
        url: `${fixturePath}/scroll.html`,
        scenarios:[{
          actions: [
            {type: 'scroll', selector: '.box', position: [0, 1000], delay: 1000},
          ]
        }]
      })
      vbot.start({
        playbook: playbookOpts
      })
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
    it('should emit action.fail when element not found', function (done) {
      let playbookOpts = _.assign(basePlaybookOpts, {
        url: `${fixturePath}/assertInnerText.html`,
        scenarios:[{
          actions: [
            {type: 'exist', selector: '#nofound', waitTimeout: 2000}
          ]
        }]
      })
      vbot.start({
        playbook: playbookOpts
      })
      let failed = false
      vbot.on('action.fail', (log) => {
        failed = true
        assert(log)
      })
      vbot.on('end', () => {
        assert(failed)
        done()
      })
    });
  });
})
