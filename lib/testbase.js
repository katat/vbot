'use strict';
var phantomcss = require('phantomcss');
module.exports = function() {
  var args = casper.cli.options;
  var schemaFile = args['schema'];
  var newSchemaFile = args['nf'];
  var scenarioFilter = args['scenario'];
  var output = args['output'];
  var imgdir = args['imgdir'];
  var rebase = args['rebase'];
  var that = this, captureDelay, defaultCaptureSelector, failures = [], newImages = [];

  var runActions = function(scenario, test) {
    scenario.actions.forEach(function(action, stepIndex) {
      casper.then(function() {
        that.waitForSelector(action.waitFor, action.waitTimeout, test, function() {
          if (action.type === 'scrollTo') {
            that.evaluateInBrowser(action)
          }
          if (action.type === 'click') {
            casper.click(action.waitFor);
          }
          if (action.type === 'enter') {
            that.enterText(action)
          }
          if (action.type === 'select') {
            that.selectDropdown(action)
          }
          if (action.shot) {
            that.capture(action, stepIndex, scenario.name)
          }
        })
      });
    });
  };

  var buildScenario = function(schema, allScenarios, scenario) {
    if (scenario.inherit) {
      console.info('%s extends %s', scenario.name, scenario.inherit);
      var baseScenarios = allScenarios.filter(function(other) {
        if (other.name === scenario.inherit) {
          return true;
        }
        return false;
      });

      scenario.actions = baseScenarios[0].actions.concat(scenario.actions);
      scenario.inherit = baseScenarios[0].inherit;
      if (scenario.inherit) {
        return buildScenario(schema, allScenarios, scenario);
      }
    }
    return scenario;
  };

  this.capture = function(action, stepIndex, folder) {
    phantomcss.screenshot(
      action.shotSelector || defaultCaptureSelector,
      action.captureDelay || captureDelay,
      null,
      folder + '/' + stepIndex + '_' + action.type + '-' + action.waitFor.replace(' ', '_'));
  }

  this.evaluateInBrowser = function(action) {
    casper.evaluate(function(_action) {
      var query = _action.waitFor || _action.scrollElm;
      var elms = document.getElementsByClassName(query.replace('.', ''));
      for (var i = 0; i < elms.length; i++) {
        elms[i].scrollLeft += _action.position[0];
        elms[i].scrollTop += _action.position[1];
      }
    }, action);
  }

  this.enterText = function(action) {
    casper.sendKeys(action.waitFor, action.value, {
      keepFocus: true
    });
    if (action.enter === true) {
      casper.sendKeys(action.waitFor, casper.page.event.key.Enter, {
        keepFocus: true
      });
    }
  }

  this.selectDropdown = function(action) {
    casper.evaluate(function(_action) {
      document.querySelector(_action.waitFor).selectedIndex = _action.selectIndex;
    }, action);
  }

  this.waitForSelector = function(selector, timeout, test, callback) {
    casper.waitForSelector(selector,
      function success() {
        test.assertExists(selector);
        callback()
      },
      function fail() {
        test.assertExist(selector + ', timeout:' + timeout);
      }, timeout);
  }

  this.initPhantomCss = function(casper, schema) {
    defaultCaptureSelector = schema.captureSelector;
    casper.options.viewportSize = {
      width: schema.viewWidth,
      height: schema.viewHeight
    };
    var imgbase = fs.workingDirectory;
    if (imgdir) {
      imgbase += imgdir;
    }
    var phantomcssOpts = {
      rebase: rebase,
      casper: casper,
      screenshotRoot: fs.absolute(imgbase + '/screenshots/' + schemaFile),
      failedComparisonsRoot: fs.absolute(imgbase + '/results/' + newSchemaFile + '/failures'),
      comparisonResultRoot: fs.absolute(imgbase + '/results/' + newSchemaFile),
      addLabelToFailedImage: false,
      addIteratorToImage: false,
      errorType: 'movement',
      transparency: 0.3,
      hideElements: schema.hideElements
    }
    if (output) {
      phantomcssOpts.onFail = function(test) {
        if (test.failFile) {
          failures.push({
            message: test.failFile.replace(imgbase, ''),
            fail: true,
            mismatch: test.mismatch
          })
        }
      }
      phantomcssOpts.onNewImage = function(test) {
        newImages.push({
          message: test.filename.replace(imgbase, ''),
          new: true
        });
      }
    }
    phantomcss.init(phantomcssOpts);
  }

  this.getSchema = function() {
    var schema;
    if (!newSchemaFile) {
      newSchemaFile = schemaFile;
    }
    var schemaFilePath = fs.workingDirectory + '/' + newSchemaFile;
    try {
      schema = JSON.parse(fs.read(schemaFilePath));
    } catch (ex) {
      casper.die('Errors when reading schema file at path: ' + schemaFilePath + '. Maybe there are syntax errors in the schema file. \nPlease have a check and run again.', 1)
    }
    return schema;
  }

  this.runSchema = function(schema) {
    var builtScenarios = [];
    schema.scenarios.forEach(function(scenario) {
      scenario = buildScenario(schema, schema.scenarios, scenario);
      builtScenarios.push(scenario);
    });
    builtScenarios.forEach(function(scenario, index) {
      if (scenarioFilter && scenario.name !== scenarioFilter) {
        return;
      }
      casper.test.begin(scenario.name, function(test) {
        scenario.url = schema.host + scenario.path;
        if (!scenario.url) {
          console.error('no url specified by scenario %s', scenario.name);
        }
        casper.start();
        casper.setHttpAuth('dev', 'q1p0w2o');
        casper.thenOpen(scenario.url, function() {
          casper.evaluate(function(scenario) {
            localStorage.clear();
            sessionStorage.clear();
            if (scenario.localStorage) {
              for (var i = 0; i < scenario.localStorage.length; i++) {
                localStorage[scenario.localStorage[i].key] = scenario.localStorage[i].value;
              }
            }
          }, scenario);
        });
        casper.wait(1000, function() {
          this.reload();
        });
        casper.then(function() {
          casper.evaluate(function() {
            var style = document.createElement('style');
            style.type = "text/css";
            style.innerHTML = '* {animation-delay: 0s !important; -webkit-animation-delay: 0s !important; -webkit-animation-duration: 0s !important;  -webkit-transition: none !important; transition: none !important; -webkit-animation: none !important; animation: none !important; }';
            document.body.appendChild(style);
          });
        });

        runActions(scenario, test, index);

        casper.then(function() {
          phantomcss.screenshot(schema.captureSelector, scenario.captureDelay, null, scenario.name + "/" + 'step_end');
        });

        if (builtScenarios.length - 1 === index) {
          casper.then(function() {
            phantomcss.compareSession();
          });
        }

        casper.test.on("fail", function(failure) {
          failures.push(failure);
        });

        casper.test.tearDown(function() {
          var outputs = newImages.concat(failures);
          if (outputs.length > 0 && output) {
            fs.write(output, JSON.stringify(outputs), 'w');
          }
        });

        casper.run(function() {
          test.done();
        });
      });
    });
  }

  this.listenPageErrors = function() {
    casper.on('page.error', function(msg, trace) {
      this.echo('Error: ' + msg, 'ERROR');
      for (var i = 0; i < trace.length; i++) {
        var step = trace[i];
        this.echo('   ' + step.file + ' (line ' + step.line + ')', 'ERROR');
      }
    });
  }

  this.start = function() {
    var schema = this.getSchema();
    this.initPhantomCss(casper, schema);
    this.listenPageErrors()
    this.runSchema(schema);
  }
  return this
}
