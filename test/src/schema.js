const assert = require('assert')
const VBot   = require('../../dist')
const _      = require('lodash')
const Ajv    = require('ajv')

describe('schema validation', async () => {
  let vbot = new VBot()

  describe('playbook schema', function () {
    let url = 'test.com/path/subpath?query=123#hash/'
    var playbook = {
      url: '',
      scenario: 'scenario name',
      size: {width: 100, height: 200},
      actions: [
        {type: 'click', selector: '#select'}
      ]
    };
    describe('validation', function () {
      it('valid', function () {
        playbook.url = 'http://' + url
        let result = vbot.validatePlaybookSchema(playbook)
        assert(result.valid)
        assert(!result.errors)
      });
      describe('actions', function () {
        var validdata = {
          url: 'http://test.com/path/subpath?query=123#hash/',
          scenario: 'scenario name',
          size: {
            width: 100,
            height: 200
          }
        };
        describe('invalid', function () {
          it('no actions', function () {
            let result = vbot.validatePlaybookSchema(validdata)
            assert(!result.valid)
            assert(result.errors[0].message, 'should have required property \'actions\'')
          });
          it('should have action type attribute', function () {
            validdata.actions = [
              {selector: '#test'}
            ]
            let result = vbot.validatePlaybookSchema(validdata)
            assert(!result.valid)
            assert.equal(result.errors[0].message, 'should have required property \'type\'')
          });
          it('captureDelay should depend on screenshot', function () {
            validdata.actions = [
              {type: 'click', selector: '#test', captureDelay: 1}
            ]
            let result = vbot.validatePlaybookSchema(validdata)
            assert(!result.valid)
            assert.equal(result.errors[0].message, 'should have property screenshot when property captureDelay is present')
          });
        });
        describe('click', function () {
          describe('invalid', function () {
            it('action type should be valid', function () {
              validdata.actions = [
                {type: 'clk', selector: '#test'}
              ]
              let result = vbot.validatePlaybookSchema(validdata)
              assert(!result.valid)
              assert.equal(result.errors[0].message, 'should be equal to one of the allowed values')
              assert.equal(result.errors[0].dataPath, '.actions[0].type')
            });
            it('click action should have selector attribute', function () {
              validdata.actions = [
                {type: 'click'}
              ]
              let result = vbot.validatePlaybookSchema(validdata)
              assert(!result.valid)
              assert.equal(result.errors[0].message, 'should have required property \'selector\'')
            });
          });
          describe('valid', function () {
            it('valid click action', function () {
              validdata.actions = [
                {type: 'click', selector: '#test', comment: 'comment', screenshot: true}
              ]
              let result = vbot.validatePlaybookSchema(validdata)
              assert(result.valid)
            });
          });
        });
        xdescribe('scrollTo', function () {
          it('should require selector attribute when it sets to true', function () {
            validdata.actions = [
              {type: 'exist', scrollTo: true}
            ]
            let result = vbot.validatePlaybookSchema(validdata)
            assert(!result.valid)
            console.log(result.errors)
          });
        });
      });
    });
    describe('conversion', function () {
      it('playbook', function () {
        playbook.url = 'http://' + url
        let converted = vbot.convertPlaybookSchema(playbook)
        assert.equal(converted.host, 'http://test.com')
        assert.equal(converted.scenarios[0].path, '/path/subpath?query=123#hash/')
        assert.deepEqual(converted, {
          host: 'http://test.com',
          name: 'test.com',
          viewWidth: 100,
          viewHeight: 200,
          scenarios: [
            {
              name: 'scenario name',
              path: '/path/subpath?query=123#hash/',
              actions: [
                {type: 'click', selector: '#select'}
              ]
            }
          ]
        })
      });
      it('http', function () {
        playbook.url = 'http://' + url
        let converted = vbot.convertPlaybookSchema(playbook)
        assert.equal(converted.host, 'http://test.com')
        assert.equal(converted.scenarios[0].path, '/path/subpath?query=123#hash/')
      });
      it('https', function () {
        playbook.url = 'https://' + url
        let converted = vbot.convertPlaybookSchema(playbook)
        assert.equal(converted.host, 'https://test.com')
        assert.equal(converted.scenarios[0].path, '/path/subpath?query=123#hash/')
      });
      it('file', function () {
        playbook.url = 'file:///' + url
        let converted = vbot.convertPlaybookSchema(playbook)
        assert.equal(converted.host, 'file://')
        assert.equal(converted.scenarios[0].path, '/test.com/path/subpath?query=123#hash/')
      });
    });
  });
})
