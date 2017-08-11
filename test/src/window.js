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
});
