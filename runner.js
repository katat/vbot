'use strict';
var x = require('casper').selectXPath;
var args = casper.cli.options;
var schemaFile = args['f'];
var newSchemaFile = args['nf'];
var scenarioFilter = args['scenario'];
var output = args['output'];
var imgdir = args['imgdir'];
var schema;
if(!newSchemaFile) {
    newSchemaFile = schemaFile;
}
try{
    schema = JSON.parse(fs.read(fs.workingDirectory + '/' + newSchemaFile));
}catch(ex) {
    console.error('There are JSON syntax errors in the schema file, please have a check and run again.');
}
// var schema = require(fs.absolute(fs.workingDirectory + '/' + schemaFile));
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
                        // if(action.wait) {
                        //     casper.wait(action.wait);
                        // }
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
                            phantomcss.screenshot(action.shotSelector||defaultCaptureSelector, action.captureDelay||captureDelay, null, scenario.name + '/' + stepIndex + '_' + action.type + '-' + action.waitFor.replace(' ', '_'));
                            // casper.then(function() {
                            // });
                        }
                        if(action.type === 'click'){
                            this.click(action.waitFor);
                            // casper.then(function() {
                            // });
                        }
                    },
                    function fail() {
                        test.assertExist(action.waitFor + ', timeout:' + action.waitTimeout);
                    }, action.waitTimeout);
            }
            if (action.type === 'enter') {
                casper.waitForSelector(action.waitFor,
                    function success() {
                        this.sendKeys(action.waitFor, action.value, {keepFocus: true});
                        if(action.enter === true) {
                            this.sendKeys(action.waitFor, casper.page.event.key.Enter , {keepFocus: true});
                        }
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
var failures = [], newImages = [];
var imgbase = fs.workingDirectory;
if(imgdir) {
    imgbase += imgdir;
}
var phantomcss = require( 'phantomcss' );
var phantomcssOpts = {
    rebase: casper.cli.get( "rebase" ),
    // SlimerJS needs explicit knowledge of this Casper, and lots of absolute paths
    casper: casper,
    // libraryRoot: fs.absolute( fs.workingDirectory + '/node_modules/phantomcss' ),
    screenshotRoot: fs.absolute( imgbase + '/screenshots/' + schemaFile ),
    failedComparisonsRoot: fs.absolute( imgbase + '/results/' + newSchemaFile + '/failures' ),
    comparisonResultRoot: fs.absolute(imgbase + '/results/' + newSchemaFile),
    addLabelToFailedImage: false,
    addIteratorToImage: false,
    errorType: 'movement',
    transparency: 0.3,
    hideElements: schema.hideElements
    /*
    fileNameGetter: function overide_file_naming(){},
    onPass: function passCallback(){},
    onTimeout: function timeoutCallback(){},
    onComplete: function completeCallback(){},
    addLabelToFailedImage: true,
    outputSettings: {
    errorColor: {
    red: 255,
    green: 255,
    blue: 0
},
}*/
}
if(output) {
    phantomcssOpts.onFail = function(test) {
        if(test.failFile) {
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

// phantomcss.turnOffAnimations();

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
    if(scenarioFilter && scenario.name !== scenarioFilter) {
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
                if(scenario.localStorage) {
                    for(var i=0; i<scenario.localStorage.length; i++) {
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
            phantomcss.screenshot(defaultCaptureSelector, scenario.captureDelay, null, scenario.name + "/" + 'step_end');
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
            if(outputs.length > 0 && output) {
                fs.write(output, JSON.stringify(outputs), 'w');
            }
            // require('utils').dump(failures);
        });

        casper.run(function() {
            test.done();
        });
    });
});
