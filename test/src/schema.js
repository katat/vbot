const assert      = require('assert')
const VBot        = require('../../dist')
const _ = require('lodash')
const Ajv = require('ajv')

describe('schema validation', async () => {
  let vbot
  const fixturePath = `file:///${__dirname}/../fixtures/html`
  const testPath = `${__dirname}`
  let opts = {
    showWindow: process.env.WIN,
    verbose: false,
    imgdir: `${testPath}/../tmp/screenshots`,
    playbook: {
      viewWidth: 375,
      viewHeight: 677
    }
  }
  process.on('unhandledRejection', (e) => {
    console.log(e)
  })

  describe('playbook schema validation', function () {
    it('v', function () {
      var ajv = new Ajv({useDefaults: true, allErrors: true});
      var schema = {
        "type": 'object',
        "properties": {
          "url": {
            "type": "string",
            "format": 'url'
          },
          "suit": { "type": "string" },
          "scenario": { "type": "string" }
        },
        "oneOf": [
          {"required": ['suit']},
          {"required": ['scenario']}
        ],
        "required": ['url']

      };

      var validData = {
        // url: 'http://test',
        // suit: 'test',
        scenario: 'test'
      };

      console.log(ajv.validate(schema, validData))
      console.log(ajv.errors)
    });
  });
})
