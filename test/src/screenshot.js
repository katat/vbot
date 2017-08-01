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
      host: `http://localhost:${serverPort}`,
      imgdir: `${testPath}/tmp/screenshots`,
      // showWindow: true
    })
    // await vbot.start()
  });
  afterEach((done) => {
    vbot.close().then(() => {
      done()
    })
  });
  describe('window size', async () => {
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
  describe('compare screenshots', function () {
      describe('base', function () {
        beforeEach(async () => {
          let imgdir = `${testPath}/tmp/compare_imgs`
          vbot = new VBot({
            verbose: false,
            playbookFile: `${testPath}/fixtures/screenshot_test.json`,
            host: `http://localhost:${serverPort}`,
            imgdir: imgdir
          })
          fs.removeSync(imgdir)
          vbot.start()
        });
        it('base', function (done) {
          let screenshot = false
          vbot.on('action.executed', (log) => {
            if (!log.screenshot) {
              return
            }
            screenshot = true
            assert([0, 2, 4, 6].indexOf(log.index) >= 0)
            assert.equal(true, log.screenshot.files.base.indexOf(`${testPath}/tmp/compare_imgs/view1/base/`) >= 0)
            assert.equal(undefined, log.screenshot.files.test)
            assert.equal(undefined, log.screenshot.files.diff)
            assert.equal(undefined, log.screenshot.misMatchPercentage)
            assert.equal(undefined, log.screenshot.isSameDimensions)
          })
          vbot.on('end', () => {
            assert(screenshot)
            done();
          })
        });
      });
      describe('same', function () {
        let threshold = 0
        beforeEach(async () => {
          return new Promise(async (resolve) => {
            let imgdir = `${testPath}/tmp/compare_imgs`
            vbot = new VBot({
              verbose: false,
              playbookFile: `${testPath}/fixtures/screenshot_test.json`,
              host: `http://localhost:${serverPort}`,
              imgdir: imgdir,
              mismatchThreshold: threshold
            })
            fs.removeSync(imgdir)
            // await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view1/base`)
            vbot.start()
            vbot.on('end', async () => {
              await vbot.close()
              vbot = new VBot({
                verbose: false,
                playbookFile: `${testPath}/fixtures/screenshot_test.json`,
                host: `http://localhost:${serverPort}`,
                imgdir: imgdir,
                mismatchThreshold: threshold
              })
              vbot.start()
              resolve()
            })
          })
        });
        it('same', function (done) {
          let count = 0
          vbot.on('action.executed', (log) => {
            if (!log.screenshot) {
              return
            }
            assert([0, 2, 4, 6].indexOf(log.index) >= 0)
            assert.equal(true, log.screenshot.files.base.indexOf(`${testPath}/tmp/compare_imgs/view1/base/`) >= 0)
            assert.equal(true, log.screenshot.files.test.indexOf(`${testPath}/tmp/compare_imgs/view1/test/`) >= 0)
            assert(!log.screenshot.files.diff)
            assert.equal(0, log.screenshot.analysis.misMatchPercentage)
            assert.equal(true, log.screenshot.analysis.isSameDimensions)
            assert.equal(true, log.screenshot.analysis.passThreshold)
          })
          vbot.on('end', () => {
            done();
          })
        });
      });
      describe('diff', function () {
        let initDiffVbot = async (threshold) => {
          let imgdir = `${testPath}/tmp/compare_imgs`
          vbot = new VBot({
            verbose: false,
            playbookFile: `${testPath}/fixtures/screenshot_test.json`,
            host: `http://localhost:${serverPort}`,
            imgdir: imgdir,
            mismatchThreshold: threshold
          })
          fs.removeSync(imgdir)
          // await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view1/base`)
          await fs.copy(`${testPath}/fixtures/compare_imgs/diff/2_scrollTo-.box.png`, `${testPath}/tmp/compare_imgs/view1/base/2_scrollTo-.box.png`)
          vbot.start()
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
              assert([0, 2, 4, 6].indexOf(log.index) >= 0)
              if (log.index === 2) {
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
              assert(diff)
              done();
            })
          });
        });
        describe('with threshold', function () {
          beforeEach(async () => {
            await initDiffVbot(0.1)
          });
          it('should generate diff file and related analysis', function (done) {
            let count = 0
            vbot.on('action.executed', (log) => {
              if (!log.screenshot) {
                return
              }
              assert([0, 2, 4, 6].indexOf(log.index) >= 0)
              if (log.index === 2) {
                assert(log.screenshot.files.base)
                assert(log.screenshot.files.test)
                assert(log.screenshot.files.diff)
                assert(log.screenshot.analysis.isSameDimensions)
                assert(log.screenshot.analysis.misMatchPercentage)
                assert(log.screenshot.analysis.passThreshold)
                return
              }
              assert(!log.screenshot.files.diff)
              assert(!log.screenshot.files.test)
              assert(log.screenshot.files.base)
            })
            vbot.on('end', () => {
              done();
            })
          });
        });
      });
      describe('rebase', function () {
        beforeEach(async () => {
          let imgdir = `${testPath}/tmp/compare_imgs`
          vbot = new VBot({
            verbose: false,
            playbookFile: `${testPath}/fixtures/screenshot_test.json`,
            host: `http://localhost:${serverPort}`,
            imgdir: imgdir,
            rebase: true
          })
          fs.removeSync(imgdir)
          await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view1/base`)
          await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view1/test`)
          await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view1/diff`)
          vbot.start()
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
            assert(!fs.existsSync(`${testPath}/fixtures/compare_imgs/view1/diff`))
            assert(!fs.existsSync(`${testPath}/fixtures/compare_imgs/view1/test`))
          })
          vbot.on('end', () => {
            done();
          })
        });
      });
    });
});
