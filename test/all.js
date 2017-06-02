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
      projectFile: `${__dirname}/project.json`,
      host: `http://localhost:${serverPort}`,
      imgdir: `${__dirname}/tmp`
    })
    await vbot.start()
  });
  afterEach((done) => {
    vbot.client.close().then(() => {
      done()
    })
  });
  describe('window size', function () {
    it('should resize window', (done) => {
      vbot.on('started', async () => {
        let evalResponse = await vbot.client.eval('JSON.stringify({width: window.innerWidth, height: window.innerHeight})')
        let size = JSON.parse(evalResponse.result.value)
        assert.equal(375, size.width)
        assert.equal(677, size.height)
      })
      vbot.on('finished', () => {
        done()
      })
    });
  });
});
