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
        path: 'app',
        message: 'npm run preview -- --host 127.0.0.1 --port 3000',
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
