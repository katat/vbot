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
         //url: `http://www.ctrln.com.ar/#`,
         //url: `https://www.nimbletank.com/`,
          //url: `http://sjfinearts.com/`,
          scenario: 'view2',
          size: {width: 1200,height: 1000},
         /* actions: [//sjf
              {type: 'move', selector: '#content', start_position: [0,0], end_position: [1,1], screenshot: true, delay: 10000},
              {type: 'click', selector: '#gallery-7_1 > div > div.galleria-stage > div.galleria-image-nav > div.galleria-image-nav-right', screenshot: true},
          ]*/
         /* "actions": [//ctrln
              {"type": "exist","selector": "#home > div > nav > ul > li.nosotros > a", "screenshot": true },
              {"type": "move", "selector": "#home > div > nav > ul > li.nosotros > a", "start_position": [200, 300], "end_position": [50, 100], "screenshot": true, delay: 2000},
              {"type": "move", "selector": "#home > div > nav > ul > li.nosotros > a", "start_position": [200, 220], "end_position": [80, 100], "screenshot": true, delay: 2000},
          ]*/
         /* actions: [//nim
            //{type: 'click', selector: '#content > header > div > div.relative.fullscreen.fullscreen-height.fullscreen-mobile > button > i', delay:2000},
            {type: 'scroll', selector: 'html', delay: 1000, position: [0,925]},
            {type: 'move', selector: 'body > div.section.section-first.section-last.fullscreen-css.fullscreen-mobile.work > div > div.owl-stage-outer.skrollable.skrollable-between > div > div:nth-child(9)', start_position: [0, 0], end_position: [300, 0], screenshot: true},
            {type: 'move', selector: 'body > div.section.section-first.section-last.fullscreen-css.fullscreen-mobile.work > div > div.owl-stage-outer.skrollable.skrollable-between > div > div:nth-child(10)', start_position: [10, 20], end_position: [350, 19], delay: 2000, screenshot: true},
            {type: 'exist', selector: 'body > div.section.section-first.section-last.fullscreen-css.fullscreen-mobile.work > div > div.owl-stage-outer.skrollable.skrollable-between > div > div:nth-child(10)', start_position: [10, 20], end_position: [350, 19], delay: 2000, screenshot: true},
            //{type: 'move', selector: 'body > div.section.section-first.section-last.fullscreen-css.fullscreen-mobile.work > div > div.owl-stage-outer.skrollable.skrollable-between > div > div:nth-child(9) > div > a', start_position: [50, 100], end_position: [200, 300],screenshot: true, delay: 2000},
        ]*/
        actions: [
          {type: 'move', selector: '#changecolor', start_position: [80, 100], end_position: [200, 260], delay: 2000},
          {type: 'move', selector: '#changecolor', start_position: [50, 100], end_position: [200, 300], delay: 2000},
        ]
     }
   });

    describe.only('over', function () {
        beforeEach(async () => {
          vbot = new VBot({verbose: true,showWindow: true})
        });
        it('over', function (done){
        vbot.start(playbook)
        vbot.on('action.executed', () => {
        vbot.chromejs.eval(`document.querySelector('#changecolor').className`).then((data) => {
        assert.equal(data.result.value,'blankk')
        console.log(data);
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
        vbot = new VBot({verbose: true,showWindow: true})
        fs.removeSync(imgdir)
      });
      it('base', function (done) {
        let screenshot = false
        vbot.start(playbook, {imgdir: imgdir})
        //console.log(playbook);
        //console.log(imgdir);
        //console.log('passed');
        vbot.on('action.executed', (log) => {
          if (!log.screenshot) {
            console.log('no screenshot command');
            return
        }
          console.log('start action.executed');
          screenshot = true
          //assert([0, 2, 4, 6].indexOf(log.index) >= 0)
          assert.equal(true, log.screenshot.files.base.indexOf(`${testPath}/tmp/compare_imgs/view2/base/`) >= 0)
          assert(fs.existsSync(log.screenshot.files.base))
          assert.equal(undefined, log.screenshot.files.test)
          assert.equal(undefined, log.screenshot.files.diff)
          assert.equal(undefined, log.screenshot.misMatchPercentage)
          assert.equal(undefined, log.screenshot.isSameDimensions)
        })
        vbot.on('end', () => {
          console.log(screenshot);
          assert(screenshot,'error')
          done();
        })
      });
  });
    describe('diff', function () {
      let initDiffVbot = async (threshold) => {
        let imgdir = `${testPath}/tmp/compare_imgs`
        vbot = new VBot({verbose: true})
        fs.removeSync(imgdir)
        // await fs.copy(`${testPath}/fixtures/compare_imgs/same`, `${testPath}/tmp/compare_imgs/view2/base`)
        await fs.copy(`${testPath}/fixtures/compare_imgs/diff/cdg_test.png`, `${testPath}/tmp/compare_imgs/view2/base/1_move-#home_>_div_>_nav_>_ul_>_li.nosotros_>_a.png`)
        //await fs.copy(`${testPath}/fixtures/compare_imgs/diff/1_test.png`, `${testPath}/tmp/compare_imgs/view2/base/1_move-#changecolor.png`)
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
                console.log('log.screenshot is false');
              return
            }
            //assert([0, 2, 4, 6].indexOf(log.index) >= 0)
            console.log('this is log index : ',log.index);
            if (log.index === 1) {
                console.log('here is index 1');
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
            console.log('start screenshot.diff ');
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
