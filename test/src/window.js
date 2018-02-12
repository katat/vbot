const localServer = require('../fixtures/server.js')
const assert      = require('assert')
const VBot        = require('../../dist')
const testPath = `${__dirname}/../`
describe('window', async () => {
  let vbot
  afterEach((done) => {
    vbot.close().then(() => {
      done()
    })
  });
  describe('size', async () => {
    it('should resize window', (done) => {
      vbot = new VBot({
        verbose: false,
        playbook: {
          viewWidth: 375,
          viewHeight: 677,
          url: `file:///${testPath}fixtures/html/click.html`,
          scenarios: [
            {
              name: 'window size',
              actions: [
                {type:'exist', selector:'button'}
              ]
            }
          ]
        }
      })
      vbot.start()
      let asserted = false
      vbot.on('scenario.start', async () => {
        let evalResponse = await vbot.chromejs.eval('JSON.stringify({width: window.innerWidth, height: window.innerHeight})')
        let size = JSON.parse(evalResponse.result.value)
        assert.equal(375, size.width)
        assert.equal(677, size.height)
        asserted = true
      })
      vbot.on('end', () => {
        assert(asserted)
        done()
      })
    });
  });
  describe('log', async () => {
    it('console', (done) => {
      vbot = new VBot({
        verbose: false,
        playbook: {
          viewWidth: 375,
          viewHeight: 677,
          url: `file:///${testPath}fixtures/html/log.html`,
          scenarios: [
            {
              name: 'console log',
              actions: []
            }
          ]
        }
      })
      vbot.start()
      let count = 0
      vbot.on('console', (log) => {
        count ++
        assert.equal(log.type, 'log')
        if (count === 1) {
          assert.equal(log.msg, 'test')
        }
        if (count === 2) {
          assert.equal(log.msg, 'object')
        }
      })
      vbot.on('end', () => {
        assert(count !== 0)
        done()
      })
    });
    it('network error', function (done) {
      vbot = new VBot({
        verbose: false,
        playbook: {
          viewWidth: 375,
          viewHeight: 677,
          //url: `http://shouldnotfindthisurlblabla.bla`,
          url: `http://localhost:55558`,
          scenarios: [
            {
              name: 'network error',
              actions: []
            }
          ]
        }
      })
      vbot.start()
      let count = 0
      vbot.on('network.error', (log) => {
        count ++
        assert(log.url)
        assert(log.method)
        assert(log.error)
      })
      vbot.on('end', () => {
        assert(count !== 0)
        done()
      })
    });
  });
});
