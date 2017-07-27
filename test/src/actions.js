const assert      = require('assert')
const VBot        = require('../../dist')
const _ = require('lodash')
describe('actions', async () => {
  const vbot = new VBot()
  let basePlaybookOpts = {
    "viewWidth": 375,
    "viewHeight": 677,
    "showWindow": process.env.WIN,
  }
  beforeEach(function () {
    vbot.removeAllListeners('end')
  });
  describe('click', () => {
    it('should click an element', (done) => {
      let playbookOpts = _.assign(basePlaybookOpts, {
        actions: [
          {type: 'click', selector: 'button'}
        ]
      })
      vbot.start({
        playbook: playbookOpts
      })
      vbot.on('end', () => {
      })
    });
  });
})
