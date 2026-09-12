module.exports = {
  daemon: true,
  run: [
    // Casual users skip Update — Start pulls GitHub and rebuilds when needed.
    {
      method: 'shell.run',
      params: {
        message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-start-prep.ps1'
      }
    },
    {
      method: 'shell.run',
      params: {
        message: '.\\target\\release\\music-server.exe',
        env: {
          MINIMAX_MM_SERVER_ROOT: 'resources\\minimaxmusic-cpp'
        },
        on: [{
          event: '/(http:\\/\\/[0-9.:]+)/',
          done: true
        }]
      }
    },
    {
      method: 'shell.run',
      params: {
        message: 'node scripts\\pinokio-serve.js',
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
