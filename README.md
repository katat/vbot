# vbot
A visual regression testing tool, that it is easy to create tests, share the works and communicate among the team.

## Install
`npm install -g vbot`

## Schema
```
{
    "viewWidth": 375,
    "viewHeight": 677,
    "captureSelector": "html",
    "host": "http://localhost:3000",
    "scenarios": [
        {
            "name": "view1",
            "path": "/view1",
            "captureDelay": 1000,
            "actions": [{
                "type": "click",
                "waitFor": ".first"
            },{
                "type": "assert",
                "waitFor": ".list-mid",
                "shot": true,
                "waitTimeout": 5000
            },{
                "type": "click",
                "waitFor": ".trade-btn button"
            },{
                "type": "scrollTo",
                "waitFor": ".box",
                "position": [100, 100]
            },{
                "type": "click",
                "waitFor": ".forget-pwd"
            }]
        },{
            "name": "view2",
            "path": "/view2",
            "captureDelay": 1000,
            "actions": [{
                "type": "click",
                "waitFor": ".hot-tab",
                "captureDelay": 1000,
                "shot": true
            }]
        }
    ]
}
```

**viewHeight** height of the browser view

**viewWidth** width of the browser view

**captureSelector** Element to be captured in screenshot. All the screenshots in a schema is capturing the same element. It is recommend to test against the whole page view, so is the `html`. However it is allowed to target any elements in the view, such as `body` or `.css-query`.

**host** The global host of for the test url path in the scenarios

**scenarios** Each scenario can comprise of a set of actions in the page view. It groups a set of cohesive tests.
 - **path** The url path for the scenario test to begin with
 - **captureDelay** Delay(millisecond) to wait before take the final scenario screenshot. For the purpose of avoiding taking screenshot during the page animation.
 - **actions** A set of test steps
   - **type** Action Type
     - `assert`, `click`, `scrollTo`
   - **waitFor** Wait for the element to exist before proceeding to the action type. It is the target element regarding to the action.
   - **waitTimeout** Maximum time to wait for the element `waitFor` exists in the DOM. If waited longer than this setting, it throws error of not found the `waitFor` element.
   - **shot** Take screenshot before this step action is executed.
   - **captureDelay** Delay(millisecond) to wait before this step's screenshot is taken.
   - **position** The [x, y] position to scroll to, when using action type `scrollTo`.

## Run tests

To run the tests following the scenarios definition file, use the command below.

`vbot --f=test.json`

vbot will visit the pages defined in the test.json, the schema file, and carry out test steps, taking screenshots which will be compared in the end. All the screenshot taken will be in folders.

The `screenshots` is the based images, while the `results` have the comparison result images. To refresh the based images, remove the screenshots folder and run command above, it will look for this folder and create it if it doesn't exist and treat the images in this folder as the base images.

## Contribute

After changes made, in the tests directory, run `./test.sh` to make sure all the tests are passed.
