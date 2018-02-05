const localServer = require('../fixtures/server.js')
const assert      = require('assert')
const fs          = require('fs-extra')
const VBot        = require('../../dist')
const testPath = `${__dirname}/../`
describe('screenshot', async () => {
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

    describe('compare screenshots', function () {
      let playbook
      beforeEach(function () {
        playbook = {
         url: `file:///${testPath}/fixtures/move.html`,
          scenario: 'view2',
          size: {width: 800,height: 800},
        actions: [
          {type: 'move', selector: '#changecolor', start_position: [80, 100], end_position: [200, 260], delay: 1000, 'screenshot': true},
          {type: 'move', selector: '#changecolor', start_position: [200, 300], end_position: [50, 100], delay: 1000, 'screenshot': true},
        ]
     }
   });

    describe('mouseover test without screenshot', function () {
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

    describe('base', function () {
      let imgdir = `${testPath}/tmp/compare_imgs`
      beforeEach(async () => {
        vbot = new VBot({verbose: false})
        fs.removeSync(imgdir)
      });
      it('base', function (done) {
        let screenshot = false
        vbot.start(playbook, {imgdir: imgdir})
        vbot.on('action.executed', (log) => {
          if (!log.screenshot) {
            return
        }
          screenshot = true
          assert.equal(true, log.screenshot.files.base.indexOf(`${testPath}/tmp/compare_imgs/view2/base/`) >= 0)
          assert(fs.existsSync(log.screenshot.files.base))
          assert.equal(undefined, log.screenshot.files.test)
          assert.equal(undefined, log.screenshot.files.diff)
          assert.equal(undefined, log.screenshot.misMatchPercentage)
          assert.equal(undefined, log.screenshot.isSameDimensions)
        })
        vbot.on('end', () => {
          assert(screenshot,'error')
          done();
        })
      });
  });
    describe('diff', function () {
      let initDiffVbot = async (threshold) => {
        let imgdir = `${testPath}/tmp/compare_imgs`
        vbot = new VBot({verbose: false})
        fs.removeSync(imgdir)
        // await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view2/base`)
        await fs.copy(`${testPath}/fixtures/compare_imgs/diff/1_test.png`, `${testPath}/tmp/compare_imgs/view2/base/1_move-#changecolor.png`)
        vbot.start(playbook, {imgdir: imgdir, mismatchThreshold: threshold})
      }
      describe('without threshold', function () {
        beforeEach(async () => {
          await initDiffVbot()
        });
        it('should generate diff file and related analysis', function (done) {
          let count = 0, diff = false
          vbot.on('action.executed', (log) => {
            if (!log.screenshot) {
              return
            }
            //assert([0, 2, 4, 6].indexOf(log.index) >= 0)
            if (log.index === 1) {
              // assert(log.screenshot.files.base)
              // assert(log.screenshot.files.test)
              // assert(log.screenshot.files.diff)
              // assert(log.screenshot.analysis.isSameDimensions)
              // assert(log.screenshot.analysis.misMatchPercentage)
              // assert(!log.screenshot.analysis.passThreshold)
              return
            }
            assert(!log.screenshot.files.diff)
            assert(!log.screenshot.files.test)
            assert(log.screenshot.files.base)
          })
          vbot.on('screenshot.diff', (log) => {
            assert(log.screenshot.files.base)
            assert(log.screenshot.files.test)
            assert(log.screenshot.files.diff)
            assert(log.screenshot.analysis.isSameDimensions)
            assert(log.screenshot.analysis.misMatchPercentage)
            assert(!log.screenshot.analysis.passThreshold)
            diff =true
          })
          vbot.on('end', () => {
            assert(diff,'error2')
            done();
          })
        });
      });
    });


    describe('rebase', function () {
      beforeEach(async () => {
        let imgdir = `${testPath}/tmp/compare_imgs`
        vbot = new VBot({verbose: false})
        fs.removeSync(imgdir)
        await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view2/base`)
        await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view2/test`)
        await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view2/diff`)
        vbot.start(playbook, {imgdir: imgdir, rebase: true})
      });
      it('should remove diff and test folder and only generate base folder', function (done) {
        let count = 0
        vbot.on('action.executed', (log) => {
          if (!log.screenshot) {
            return
          }
          assert(!log.screenshot.files.diff)
          assert(!log.screenshot.files.test)
          assert(!log.screenshot.analysis)
          assert(fs.existsSync(log.screenshot.files.base))
          assert(!fs.existsSync(`${testPath}/fixtures/compare_imgs/view2/diff`))
          assert(!fs.existsSync(`${testPath}/fixtures/compare_imgs/view2/test`))
        })
        vbot.on('end', () => {
          done();
        })
      });
    });
  });
});
