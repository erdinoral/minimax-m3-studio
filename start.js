module.exports = {
  daemon: true,
  run: [
    // Stay aligned with GitHub: pull scripts, then refresh the prebuilt app zip
    // when the published COMMIT changed. Engine under runtime/resources is kept.
    {
      method: 'shell.run',
      params: {
        message: 'git pull --ff-only'
      }
    },
    {
      method: 'shell.run',
      params: {
        message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-sync-app.ps1'
      }
    },
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
