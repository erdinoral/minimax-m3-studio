module.exports = {
  daemon: true,
  run: [
    {
      method: 'shell.run',
      params: {
        path: 'runtime',
        message: '.\\music-server.exe',
        on: [{
          event: '/(http:\\/\\/[0-9.:]+)/',
          done: true
        }]
      }
    },
    {
      method: 'shell.run',
      params: {
        path: 'runtime',
        // Pinokio ships Node; no npm install needed.
        message: 'node serve.js',
        on: [{
          event: '/(http:\\/\\/[0-9.:]+)/',
          done: true
        }]
      }
    },
    {
      method: 'local.set',
      params: {
        url: '{{input.event[1]}}'
      }
    }
  ]
}
