const assert      = require('assert')
const VBot        = require('../../dist').vbot
const _ = require('lodash')
describe('scenarios', async () => {
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
  afterEach(function (done) {
    vbot.close().then(done)
  });
  it('should run scenarios in sequence', function (done) {
    let options = _.clone(opts)
    _.assign(options.playbook, {
      url: `${fixturePath}`,
      scenarios:[
        {
          name: 'scenario one',
          path: '/click.html',
          actions: [
            {type: 'click', selector: 'button'}
          ]
        }, {
          name: 'scenario two',
          path: '/typing.html',
          actions: [
            {type: 'click', selector: 'input'},
            {type: 'typing', value: 'hello', enter: true}
          ]
        }
      ]
    })
    let scenarioOneEnded = false, scenarioTwoEnded = false, failed = false
    vbot = new VBot(options)
    vbot.start()
    vbot.on('action.fail', () => {
      failed = true
    })
    vbot.on('scenario.end', (scenario) => {
      if (scenario.name === 'scenario one') {
        scenarioOneEnded = true
        vbot.chromejs.eval(`document.querySelector('button').innerText`).then((data) => {
          assert.equal(data.result.value, 'Clicked')
          vbot.close()
        })
      }
      if (scenario.name === 'scenario two') {
        scenarioTwoEnded = true
        vbot.chromejs.eval(`document.querySelector('input').value`).then((data) => {
          assert.equal(data.result.value, 'hello')
        }).then(() => {
          return vbot.chromejs.eval(`document.querySelector('#demo').innerHTML`).then((data) => {
            assert.equal(data.result.value, 'pressed enter')
            vbot.close()
            done()
          })
        })
      }
    })
    vbot.on('end', () => {
      assert(!failed)
      assert(scenarioOneEnded)
      assert(scenarioTwoEnded)
    })
  });
})
