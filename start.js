module.exports = {
  daemon: true,
  run: [
    {
      method: 'shell.run',
      params: {
        path: '.',
        message: '.\\target\\release\\music-server.exe',
        on: [{
          // music-server prints: music-server listening on http://127.0.0.1:8765
          event: '/(http:\\/\\/[0-9.:]+)/',
          done: true
        }]
      }
    },
    {
      method: 'shell.run',
      params: {
        path: 'app',
        message: 'npm run dev',
        on: [{
          // Vite prints Local: http://localhost:3000/ (or 0.0.0.0)
          event: '/(http:\\/\\/[0-9.:]+)/',
          done: true
        }]
      }
    },
    {
      method: 'local.set',
      params: {
        // Capture group from the previous shell.on regex (Vite URL).
        url: '{{input.event[1]}}'
      }
    }
  ]
}
