const localServer = require('../fixtures/server.js')
const assert      = require('assert')
const fs          = require('fs-extra')
const VBot        = require('../../dist')
const testPath = `${__dirname}/../`
describe('move action test', async () => {
  let serverPort, vbot
  before((done) => {
    localServer(undefined, (err, instance) => {
      serverPort = instance.info.port
      done()
    })
    process.on('uncaughtException', function(error) {
      console.log(error)
    })
    process.on('unhandledRejection', function(error) {
      console.log(error)
    })
  })
  after(localServer.stop)
  beforeEach(async () => {
    vbot = new VBot({
      verbose: false,
      playbookFile: `${testPath}/fixtures/project.json`,
      //host: `http://localhost:${serverPort}`,
      host: `file:///${testPath}/fixtures/move.html`,
      imgdir: `${testPath}/tmp/screenshots`,
      showWindow: false
    })
    // await vbot.start()
  });
  afterEach((done) => {
    vbot.close().then(() => {
      done()
    })
  });

    describe('move actions', function () {
      let playbook
      beforeEach(function () {
        playbook = {
         url: `file:///${testPath}/fixtures/move.html`,
          scenario: 'view2',
          size: {width: 800,height: 800},
        actions: [
          {type: 'move', selector: '#changecolor', start_position: [80, 100], end_position: [200, 260], delay: 1000},
          {type: 'move', selector: '#changecolor', start_position: [200, 300], end_position: [50, 100], delay: 1000},
        ]
     }
   });
        describe('mouseover test', function () {
            beforeEach(async () => {
              vbot = new VBot({verbose: true,showWindow: true})
            });
            it('over', function (done){
            vbot.start(playbook)
            vbot.on('action.executed', () => {
            vbot.chromejs.eval(`document.querySelector('#changecolor').className`).then((data) => {
            assert.equal(data.result.value,'blank')
                })
            })
            vbot.on('end', () => {
                done()
            })
        });
    });
  });
});
