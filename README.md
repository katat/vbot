# VBot
> A visual regression testing library/tool, aims to quickly automate browser-based tests with minimum development overhead.

## Features
 - **JSON-based**
 *Test steps defined in JSON, clearer to have one to one action mapping to browser interactions*

 - **Screenshot Comparison**
 *Screenshots can be taken and compared with previous automatically*

 - **Chrome**
 *Chrome is used to automate the testings, can run in headless mode or with a visible browser window during testing*

 - **Programming or CLI mode**
 *Support testing with frameworks like mocha, or using VBot's command line tool*

## Requirements
 - Node 6 or later
 - Chrome 59 or later

## Install
`npm install vbot`

## Test Modes
VBot supports testings in both programming mode or CLI mode.

### Programming mode
To avoid false negative result from the tests, it is common to reset backend data before/after each test case execution. VBot exposes programming APIs to be used with testing frameworks like mocha or ava etc.

#### Mocha Example

```javascript
describe('examples', () => {
  let vbot
  afterEach((done) => {
    //close chrome instance after each test case
    vbot.close().then(done)
  });
  it('todo', function (done) {
    vbot = new VBot({
      imgdir    : `${testPath}/tmp/screenshots`,//specify custom screenshots' file paths
      rebase    : process.env.REBASE,// rebase, default false
      verbose   : true, //verbose logs, default true
      showWindow: process.env.WINDOW// show Chrome window, default false
    })
    vbot.start({
      //web page url to open in chrome instance before testing
      url: `file:///${testPath}/fixtures/todo/index.html`,
      //name for this test case. If imgdir option is not specified, it will use this name as a screenshot folder
      scenario: "todo",
      //size for the chrome instance window
      size: {width: 375, height: 677},
      //test steps that will be executed in order
      actions: [
        //For all the support actions types and related attributes, please refer to the action tests
        {type: "click", selector:"input#item"},
        {type: "typing", value: "drink milk", enter:true, tab:false},
        {type: "typing", value: "drink coffee", enter:true, tab:false},
        {type: "typing", value: "go to work", enter:false, tab:false},
        {type: "click", selector:"button#add>svg"},
        //comment will be used as the screenshot file name, otherwise selectorstring will be used
        {type: "click", comment: "done milk", selector:"ul#todo>li:nth-child(3)>div>button:nth-child(2)>svg", screenshot:true},
        {type: "click", comment: "done coffee", selector:"ul#todo>li:nth-child(2)>div>button:nth-child(2)>svg", screenshot:true},
        {type: "click", comment: "remove work", selector:"ul#todo>li>div>button:nth-child(1)>svg", screenshot:true}
      ]
    })
    vbot.on('action.executed', (log) => {})//event when an action executed successfully
    vbot.on('screenshot.diff', (data) => {})//event when there are differences from screenshot comparison
    vbot.on('action.fail', (log) => {})//event when an action failed to execute
    vbot.on('end', () => {//event when test case ended
      done()
    })
  });
});
```

To see how this example work in action, you can clone code of this repository and go to the folder in command line, run:

`npm install`

Then you can get a feeling of how it work by running following test commands that runs mocha tests.

##### Headless mode
To run the demo todo app test and take screenshot:

`npm test -- -g "todo"`

It will execute the test with Chrome in headless mode. You should see the verbose logs, and screenshots taken in folder `/test/tmp/screenshots/todo`

##### Visible mode
To see the tests running on Chrome visibly:

`WINDOW=true npm test -- -g "todo"`

##### Rebase
Try to update tests or the code in the demo todo app and VBot should automatically highlight the differences of the screenshots between previous and current version.

To rebase screenshots:

`REBASE=true npm test -- -g "todo"`

#### Screenshot directory
```
├── scenario name
      ├── base //baseline screenshots
      ├── test //screenshots from last test
      └── diff //screenshots with differences highlighted
```

#### Events

 - `action.executed` when an action executed successfully
 - `screenshot.diff` when there are differences from screenshot comparison
 - `action.fail` when an action failed to execute
 - `end` when test case ended

#### Supported actions
Please refer to respective mocha test `test/src/action.js`

#### gif demo the console logs
#### gif demo the browser tests in action

### CLI mode
Please see [CLI readme](cli.md)

### chrome extension
