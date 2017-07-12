const localServer = require('./fixtures/server.js')
const assert      = require('assert')
const fs          = require('fs-extra')
const VBot        = require('../dist')
describe('vbot tests', async () => {
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
      projectFile: `${__dirname}/fixtures/project.json`,
      host: `http://localhost:${serverPort}`,
      imgdir: `${__dirname}/tmp/screenshots`,
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
    beforeEach(() => {
      vbot.start()
    });
    it('should resize window', (done) => {
      vbot.on('scenario.start', async () => {
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
        vbot.start()
      });
      it('pass', (done) => {
        let project = require('./fixtures/project.json')
        let count = 0
        vbot.on('action.executed', async (log) => {
          assert.deepEqual(project.scenarios[0].actions[count], log.action)
          assert.equal(count ++, log.index)
        })
        vbot.on('action.fail', (log) => {
          assert.fail(log)
        })
        vbot.on('end', async () => {
          assert.equal(8, count)
          let data = await vbot.client.querySelector('.entered-text')
          assert.equal(data.result.subtype, 'node')
          done();
        })
      });
    });
    describe('fail', function () {
      beforeEach(async () => {
        vbot = new VBot({
          projectFile: `${__dirname}/fixtures/failtoassert.json`,
          host: `http://localhost:${serverPort}`,
          imgdir: `${__dirname}/tmp/screenshots`
        })
        vbot.start()
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
    describe('compare screenshots', function () {
      describe('base', function () {
        beforeEach(async () => {
          let imgdir = `${__dirname}/tmp/compare_imgs`
          vbot = new VBot({
            projectFile: `${__dirname}/fixtures/screenshot_test.json`,
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
            assert.equal(true, log.screenshot.files.base.indexOf(`${__dirname}/tmp/compare_imgs/view1/base/`) >= 0)
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
            let imgdir = `${__dirname}/tmp/compare_imgs`
            vbot = new VBot({
              projectFile: `${__dirname}/fixtures/screenshot_test.json`,
              host: `http://localhost:${serverPort}`,
              imgdir: imgdir,
              mismatchThreshold: threshold
            })
            fs.removeSync(imgdir)
            // await fs.copy(`${__dirname}/fixtures/compare_imgs/same`, `${__dirname}/tmp/compare_imgs/view1/base`)
            vbot.start()
            vbot.on('end', async () => {
              await vbot.close()
              vbot = new VBot({
                projectFile: `${__dirname}/fixtures/screenshot_test.json`,
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
            assert.equal(true, log.screenshot.files.base.indexOf(`${__dirname}/tmp/compare_imgs/view1/base/`) >= 0)
            assert.equal(true, log.screenshot.files.test.indexOf(`${__dirname}/tmp/compare_imgs/view1/test/`) >= 0)
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
          let imgdir = `${__dirname}/tmp/compare_imgs`
          vbot = new VBot({
            projectFile: `${__dirname}/fixtures/screenshot_test.json`,
            host: `http://localhost:${serverPort}`,
            imgdir: imgdir,
            mismatchThreshold: threshold
          })
          fs.removeSync(imgdir)
          // await fs.copy(`${__dirname}/fixtures/compare_imgs/same`, `${__dirname}/tmp/compare_imgs/view1/base`)
          await fs.copy(`${__dirname}/fixtures/compare_imgs/diff/2_scrollTo-.box.png`, `${__dirname}/tmp/compare_imgs/view1/base/2_scrollTo-.box.png`)
          vbot.start()
        }
        describe('without threshold', function () {
          beforeEach(async () => {
            await initDiffVbot()
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
                assert(!log.screenshot.analysis.passThreshold)
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
          let imgdir = `${__dirname}/tmp/compare_imgs`
          vbot = new VBot({
            projectFile: `${__dirname}/fixtures/screenshot_test.json`,
            host: `http://localhost:${serverPort}`,
            imgdir: imgdir,
            rebase: true
          })
          fs.removeSync(imgdir)
          await fs.copy(`${__dirname}/fixtures/compare_imgs/same`, `${__dirname}/tmp/compare_imgs/view1/base`)
          await fs.copy(`${__dirname}/fixtures/compare_imgs/same`, `${__dirname}/tmp/compare_imgs/view1/test`)
          await fs.copy(`${__dirname}/fixtures/compare_imgs/same`, `${__dirname}/tmp/compare_imgs/view1/diff`)
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
            assert(!fs.existsSync(`${__dirname}/fixtures/compare_imgs/view1/diff`))
            assert(!fs.existsSync(`${__dirname}/fixtures/compare_imgs/view1/test`))
          })
          vbot.on('end', () => {
            done();
          })
        });
      });
    });
    describe('single action test', async () => {
      describe('select test',async () =>{
        beforeEach(async () => {
          vbot = new VBot({
            host: `http://localhost:${serverPort}`,
            imgdir: `${__dirname}/tmp/screenshots`,
            schema:{
                viewWidth: 375,
                viewHeight: 677,
                captureSelector: "html",
                scenarios: [
                    {
                        name: "view1",
                        path: "/",
                        actions: [
                            {
                              type: "exist",
                              selector: ".box"
                            },{
                              type:"select",
                              selector:"select",
                              selectIndex:"3"
                            }
                        ]
                    }
                ]
            }
            //showWindow: true
          });
          vbot.start()
        });
        afterEach(() => {
          vbot.close()
        });
        it('should select a option', (done) => {
          vbot.on('scenario.start', async () => {
            let evalResponse = await vbot.client.eval('document.querySelector("select").value')
            assert.equal('1', evalResponse.result.value)
          })
          vbot.on('scenario.end', async () => {
            let evalResponse = await vbot.client.eval('document.querySelector("select").value')
            assert.equal('3', evalResponse.result.value)
          });
          vbot.on('end', () => {
            done()
          });
        });
      });
    });
  });
});
