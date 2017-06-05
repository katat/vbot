const localServer = require('./fixtures/server.js')
const assert      = require('assert')
const fs          = require('fs')
const VBot        = require('../lib/testbase')
describe('vbot tests', async () => {
  let serverPort, vbot
  before((done) => {
    localServer(undefined, (err, instance) => {
      serverPort = instance.info.port
      done()
    })
  })
  after(localServer.stop)
  beforeEach(async () => {
    vbot = new VBot({
      projectFile: `${__dirname}/fixtures/project.json`,
      host: `http://localhost:${serverPort}`,
      imgdir: `${__dirname}/tmp`
    })
    // await vbot.start()
  });
  afterEach((done) => {
    vbot.client.close().then(() => {
      done()
    })
  });
  describe('window size', async () => {
    beforeEach(async () => {
      await vbot.start()
    });
    it('should resize window', (done) => {
      vbot.on('start', async () => {
        let evalResponse = await vbot.client.eval('JSON.stringify({width: window.innerWidth, height: window.innerHeight})')
        let size = JSON.parse(evalResponse.result.value)
        assert.equal(375, size.width)
        assert.equal(677, size.height)
      })
      vbot.on('end', () => {
        done()
      })
    });
  });
  describe('pass or fail', async () => {
    describe('pass', async () => {
      beforeEach(async () => {
        await vbot.start()
      });
      it('pass', (done) => {
        let project = require('./fixtures/project.json')
        let count = 0
        vbot.on('action.executed', (log) => {
          assert.deepEqual(project.scenarios[0].actions[count], log.action)
          assert.equal(count ++, log.index)
        })
        vbot.on('end', () => {
          assert.equal(8, count)
          done();
        })
      });
    });
    describe('fail', function () {
      beforeEach(async () => {
        vbot = new VBot({
          projectFile: `${__dirname}/fixtures/failtoassert.json`,
          host: `http://localhost:${serverPort}`,
          imgdir: `${__dirname}/tmp`
        })
        await vbot.start()
      });
      it('fail', (done) => {
        let count = 0
        vbot.on('action.executed', (log) => {
          count ++
          assert.equal(0, log.index)
        })
        vbot.on('action.fail', (log) => {
          count ++
          assert.equal(1, log.index)
        })
        vbot.on('end', () => {
          assert.equal(2, count)
          done();
        })
      });
    });
    // describe('compare screenshots', function () {
    //   it('same', function (done) {
    //     vbot.on('action.done', (log) => {
    //
    //     })
    //     done();
    //   });
    //   it('diff', function (done) {
    //     vbot.on('action.done', (log) => {
    //
    //     })
    //     done();
    //   });
    // });
  });
});
