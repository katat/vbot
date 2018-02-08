const Hapi = require('hapi')

let instance;

var Server = function(config  = {}, callback) {
  instance = new Hapi.Server()

  config.port = config.port || 0

  instance.connection(config);

  instance.register(require('inert'), (err) => {
    if (err) {
      throw err
    }

    instance.route({
      method: 'GET',
      path: '/{param*}',
      handler: {
        directory: {
          path: __dirname
        }
      }
    })
    console.log('dsklhfsdflksdfl:' ,__dirname);
  })

  instance.start((err) => {
    if (err) {
      console.error(err)
    }
    callback(err, instance)
    //console.log('Server started.')
  })

}

Server.stop = function() {
  instance.stop()
}

module.exports = Server
