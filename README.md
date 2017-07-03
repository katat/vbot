# vbot
A visual regression testing tool, aims to help developers quickly create tests with minimum overhead, avoid repeated clicks and typings in testings, particularly helpful for single page applications or complicated web app. Automate the testings using Chrome browser with or without `headless` mode at local dev environment or on a continuous integration server.

There is a [blog post](http://katat.github.io/2017/01/09/vbot/) discussing about the motivation behind `vbot`.

## Install
`npm install -g vbot`

*PS. This tool tested with latest version of Node.js, later than version 7. It won't work with lower version Node.js*

## Schema
**viewHeight**
height of the browser view

**viewWidth**
width of the browser view

**captureSelector**
Element to be captured in screenshot. All the screenshots in a schema is capturing the same element. It is recommend to test against the whole page view, so is the `html`. However it is allowed to target any elements in the view, such as `body` or `.css-selector`.

**host**
The global host of for the test url path in the scenarios

**scenarios**
Each scenario can comprise of a set of actions in the page view. It groups a set of cohesive tests.
 - **path**  
 The url path for the scenario test to begin with
 - **captureDelay**  
 Delay(millisecond) to wait before take the final scenario screenshot. For the purpose of avoiding taking screenshot during the page animation. Apply to all the actions.

 - **actions**  
 A set of test steps
   - **type**  
   Action Type: `assert`, `click`, `enter`, `scroll`
   - **selector**  
   Wait for the element to exist before proceeding to the action type. It is the target element regarding to the action.
   - **waitTimeout**  
   Maximum time to wait for the element `selector` exists in the DOM. If waited longer than this setting, it throws error of not found the `selector` element.
   - **shot**  
   Take screenshot before this step action is executed.
   - **captureDelay**  
   Delay(millisecond) to wait before this step's screenshot is taken. Apply only to an individual action.
   - **position**  
   The [x, y] position to scroll to, when using action type `scroll`.
   - **scrollTo**
   Set to `true` will scroll the element matched with the selector into the view.

### Example

Let's take a look at how vbot can ease the VRT process. Suppose we want to test this [TODO](http://todomvc.com/examples/react) web app using vbot. We define the interaction flow in a JSON file as below:

```json
{
    "viewWidth": 375,
    "viewHeight": 677,
    "captureSelector": "html",
    "host": "http://todomvc.com",
    "scenarios": [
        {
            "name": "todo test",
            "path": "/examples/react",
            "actions": [
                {
                    "type": "assert",
                    "selector": ".new-todo",
                    "shot": true,
                    "comment": "wait for the input element .new-todo appear and take a screenshot"
                },{
                    "type": "enter",
                    "selector": ".new-todo",
                    "value": "drink a cup of coffee",
                    "enter": true,
                    "comment": "enter task message and press 'enter' key"
                },{
                    "type": "assert",
                    "selector": "ul.todo-list li:nth-child(1)",
                    "shot": true,
                    "comment": "make sure there is a newly created task in the list and take screenshot"
                },{
                    "type": "enter",
                    "selector": ".new-todo",
                    "value": "drink another cup of coffee",
                    "enter": true,
                    "comment": "create second task"
                },{
                    "type": "assert",
                    "selector": "ul.todo-list li:nth-child(2)",
                    "shot": true,
                    "comment": "ensure the second task is created"
                },{
                    "type": "click",
                    "selector": "ul.todo-list li:nth-child(1) .toggle",
                    "comment": "mark the first task as completed"
                },{
                    "type": "assert",
                    "selector": "ul.todo-list li.completed:nth-child(1)",
                    "shot": true,
                    "commend": "ensure the completed status is reflected in the view and take screenshot"
                }
            ]
        }
    ]
}

```

Suppose this test definition is store in `test.json` file. To execute the tests, run the command below.

```bash
vbot -f=test.json
```

vbot will execute the actions defined in the test.json, the schema file,  taking screenshots which will be compared in the end. All the screenshot taken will be in default folder `vbot`.

The `base` is the based image folder and `test` is the newly generated images, while the `diff` have the comparison result images. To rebase the images, use `rebase` flag, such as `vbot -f=test.json --rebase`, the images in the `base` folder will be refreshed.

In addition to the screenshots, it prints out the testings reports at the end of the tests, showing which tests passed or failed with a mismatch percentage compared with the baseline.

Often, there are needs to see the test in action with a real browser. The command line tool provides a debug mode to see the tests in action

```bash
vbot -f=test.json -d
```

When only a certain number of scenarios to be run, filter can be specified to only run the scenarios with the names matched.

```bash
vbot -f=test.json -s todo
```

## Screenshots
Below are the screenshots captured during the interaction flow:

------------

```json
{
    "type": "assert",
    "selector": ".new-todo",
    "shot": true,
    "comment": "wait for the input element .new-todo appear and take a screenshot"
}
```
![0_assert-.new-todo.png](img/0_assert-.new-todo.png)

-------------
```json
{
    "type": "enter",
    "selector": ".new-todo",
    "value": "drink a cup of coffee",
    "enter": true,
    "comment": "enter task message and press 'enter' key"
},{
    "type": "assert",
    "selector": "ul.todo-list li:nth-child(1)",
    "shot": true,
    "comment": "make sure there is a newly created task in the list and take screenshot"
}
```
![2_assert-ul.todo-list_li:nth-child(1).png](img/2_step.png)

--------------
```json
{
    "type": "enter",
    "selector": ".new-todo",
    "value": "drink another cup of coffee",
    "enter": true,
    "comment": "create second task"
},{
    "type": "assert",
    "selector": "ul.todo-list li:nth-child(2)",
    "shot": true,
    "comment": "ensure the second task is created"
}
```
![4_assert-ul.todo-list_li:nth-child(2).png](img/4_step.png)

---------------
```json
{
    "type": "click",
    "selector": "ul.todo-list li:nth-child(1) .toggle",
    "comment": "mark the first task as completed"
},{
    "type": "assert",
    "selector": "ul.todo-list li.completed:nth-child(1)",
    "shot": true,
    "comment": "ensure the completed status is reflected in the view and take screenshot"
}
```
![6_assert-ul.todo-list_li.completed:nth-child(1).png](img/6_step.png)

------------

If this is the first time vbot run the tests for this JSON definition file, the images generated are the baselines. The subsequent tests will compare the newly generated image file with the baselines and highlight the differences if it is not 100% match. For example, let's change the action definition below:

```json
{
    "type": "enter",
    "selector": ".new-todo",
    "value": "drink a cup of coffee",
    "enter": true
}
```

to

```json
{
    "type": "enter",
    "selector": ".new-todo",
    "value": "drink a cup of milk",
    "enter": true
}
```

After re-run the command line above, it should report there is test result mismatch the baseline and generated a image that highlights the difference:

------------------

![2_assert-ul.todo-list_li:nth-child(1).fail.png](img/2_step.fail.png)

------------------
## Welcome contributions

Fork and make changes. In the tests directory, run `npm test` to make sure all the tests are passed. Welcome pull requests or request new features.
