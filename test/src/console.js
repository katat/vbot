const assert      = require('assert')
const VBot        = require('../../dist')
const _ = require('lodash')

process.on('unhandledRejection', (e) => {
  console.log(e)
})

describe('console', async () => {
	let vbot
  const fixturePath = `file:///${__dirname}/../fixtures/html`
  const testPath = `${__dirname}`
  let playbook = {
    size: {width: 375, height: 677}
  }
  let opts = {
    showWindow: process.env.WIN,
    verbose: false,
    imgdir: `${testPath}/../tmp/screenshots`,
    playbook: playbook
  }
  beforeEach(function () {
    vbot = new VBot(opts)
  });
  afterEach(function (done) {
    vbot.close().then(done)
  });
	it('should get console from browser', function (done) {
		_.assign(playbook, {
			url: `${fixturePath}/console.html`,
			scenario: this.test.title,
			actions: [
				{type: 'click', selector: 'button'},
				{type: 'exist', selector: 'button'}
			]
		})
		vbot.start(playbook)
		vbot.on('end', () => {
			assert.equal(2, vbot.consoleList.length)
			done();
		})
	});
});
