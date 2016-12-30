'use strict';

var x = require('casper').selectXPath;
var args = casper.cli.options;
var schemaFile = args['f'];
var schema = require(fs.absolute(fs.workingDirectory + '/' + schemaFile));
var defaultCaptureSelector = schema.captureSelector;
casper.options.viewportSize = {width: schema.viewWidth, height: schema.viewHeight};
casper.on('page.error', function(msg, trace) {
   this.echo('Error: ' + msg, 'ERROR');
   for(var i=0; i<trace.length; i++) {
       var step = trace[i];
       this.echo('   ' + step.file + ' (line ' + step.line + ')', 'ERROR');
   }
});
var fs = require('fs');
var captureDelay = null;
var runActions = function(scenario, test) {
    scenario.actions.forEach(function(action, stepIndex) {
        casper.then(function() {
            if (action.type.indexOf(['click', 'assert', 'scrollTo'])) {
                casper.waitForSelector(action.waitFor,
                    function success() {
                        test.assertExists(action.waitFor);
                        if(action.wait) {
                            casper.wait(action.wait);
                        }
                        if(action.type === 'scrollTo') {
                            casper.evaluate(function(action) {
                                var query = action.waitFor || action.scrollElm;
                                var elms = document.getElementsByClassName(query.replace('.', ''));
                                for(var i=0; i<elms.length; i++) {
                                    elms[i].scrollLeft += action.position[0];
                                    elms[i].scrollTop += action.position[1];
                                }
                            }, action);
                        }
                        if(action.shot) {
                            casper.then(function() {
                                phantomcss.screenshot(action.shotSelector||defaultCaptureSelector, action.captureDelay||captureDelay, null, scenario.name + '/step_' + stepIndex);
                            });
                        }
                        if(action.type === 'click'){
                            casper.then(function() {
                                this.click(action.waitFor);
                            });
                        }
                    },
                    function fail() {
                        test.assertExists(action.waitFor);
                    }, action.waitTimeout);
            }
            if (action.type === 'enter') {
                casper.waitForSelector(action.waitFor,
                    function success() {
                        this.sendKeys(action.waitFor, action.value);
                    },
                    function fail() {
                        test.assertExists(action.waitFor);
                    });
            }
        });
    });
};

var buildScenario = function (schema, allScenarios, scenario) {
    if (scenario.inherit) {
        console.info('%s extends %s', scenario.name, scenario.inherit);
        var baseScenarios = allScenarios.filter(function(other) {
            if(other.name === scenario.inherit) {
                return true;
            }
            return false;
        });

        scenario.actions = baseScenarios[0].actions.concat(scenario.actions);
        scenario.inherit = baseScenarios[0].inherit;
        if(scenario.inherit){
            return buildScenario(schema, allScenarios, scenario);
        }
    }
    return scenario;
};

// var path = fs.absolute( fs.workingDirectory + '/node_modules/phantomcss/phantomcss.js' );
var phantomcss = require( 'phantomcss' );
phantomcss.init({
    rebase: casper.cli.get( "rebase" ),
    // SlimerJS needs explicit knowledge of this Casper, and lots of absolute paths
    casper: casper,
    // libraryRoot: fs.absolute( fs.workingDirectory + '/node_modules/phantomcss' ),
    screenshotRoot: fs.absolute( fs.workingDirectory + '/screenshots/' + schemaFile ),
    failedComparisonsRoot: fs.absolute( fs.workingDirectory + '/results/' + schemaFile + '/failures' ),
    comparisonResultRoot: fs.absolute(fs.workingDirectory + '/results/' + schemaFile),
    addLabelToFailedImage: false,
    addIteratorToImage: false,
    errorType: 'movement',
    transparency: 0.3
    /*
    fileNameGetter: function overide_file_naming(){},
    onPass: function passCallback(){},
    onFail: function failCallback(){},
    onTimeout: function timeoutCallback(){},
    onComplete: function completeCallback(){},
    hideElements: '#thing.waitFor',
    addLabelToFailedImage: true,
    outputSettings: {
    errorColor: {
    red: 255,
    green: 255,
    blue: 0
},
}*/
});

var builtScenarios = [];
schema.scenarios.forEach(function(scenario) {
    scenario = buildScenario(schema, schema.scenarios, scenario);
    builtScenarios.push(scenario);
});
var specific = casper.cli.get('scen');
if (specific) {
    builtScenarios = builtScenarios.filter(function(scenario) {
        return scenario.name === specific ? true : false;
    });
}
builtScenarios.forEach(function(scenario, index) {
    phantom.clearCookies();
    casper.test.begin(scenario.name, function(test) {
        scenario.url = schema.host + scenario.path;
        if (!scenario.url) {
            console.error('no url specified by scenario %s', scenario.name);
        }
        // casper.clear();
        casper.start(scenario.url, function() {
            // this.clear();
            this.wait(1000, function() {
                this.reload();
            });
        });
        casper.then(function() {
            casper.evaluate(function() {
                var style = document.createElement('style');
                style.innerHTML = '* {animation-delay: 0s !important; -webkit-animation-delay: 0s !important; -webkit-animation-duration: 0s !important; }';
                document.body.appendChild(style);
            });
        });

        runActions(scenario, test, index);

        casper.then(function() {
            phantomcss.screenshot(defaultCaptureSelector, scenario.captureDelay, null, scenario.name + "/" + 'step_end');
        });

        if (builtScenarios.length - 1 === index) {
            casper.then(function() {
                phantomcss.compareSession();
            });
        }

        casper.evaluate(function() {
            localStorage.clear();
        }, {});

        casper.run(function() {
            test.done();
        });
    });
});
