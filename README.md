# vbot
Ease visual regression tests.

## motivations of visual regression test
for the front end, even small updates to the code, may requires a lot of interactions on the page in order to see the changes.
### agile development
encourage the team to keep refactoring the front end code into a healthy shape. Visual regression test help quickly gather visual feedbacks for changes, making it easier to test the components used in different parts of the web applications.
### avoid manual ui testing
manual ui testing is tedious, and kill efficiency and motivations of a team to progress.

## existing visual regression test solutions
- backstopjs, work well for static web pages
- PhantomCSS, require writing lots of JS code

## why vbot, what it brings compared to others
### easy to make interaction flows
JSON based schema to defined view interactions, without writing casper/phantomjs code. Easy to create the interaction flow

because most of the common interactions are: assert, screenshot, click, scroll, these interactions are defined in the vbot JSON schema to cover most of the interaction use cases.

### easy to distribute among the team
JSON based schema makes it much easier to share test schema with the team members, as it has common understandings over the definitions, avoid monkey JS test codes.

### take care of SPA use cases
SPA usually has pretty complicated functions inside a same view to interact with. A JSON based action flow definition could simplify the process of creating these types of tests.

## technical parts
### what vbot based on?
- casperjs
- phantomjs
- phantomcss

## how to use
### schema definitions
### test results
examples

## what in plan
- support mocking http requests
