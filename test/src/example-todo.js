const assert      = require('assert')
const VBot        = require('../../dist')
const testPath = `${__dirname}/../`
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
      //size for the chrome instance window
      size: {width: 375, height: 677},
      //name for this test case. If imgdir option is not specified, it will use this name as a screenshot folder
      scenario: "todo",
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
        {type: "click", comment: "remove work", selector:"ul#todo>li>div>button:nth-child(1)>svg", screenshot:true},
        {type: "reload", comment: "reload page", screenshot:true}
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
