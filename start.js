module.exports = {
  daemon: true,
  run: [
    {
      method: 'shell.run',
      params: {
        // Repo-built server; engine lives under resources/ (not a release zip).
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
        // Pinokio ships Node; serves app/dist from this repo.
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
