module.exports = {
  run: [
    {
      method: 'shell.run',
      params: {
        message: 'git pull --ff-only'
      }
    },
    {
      method: 'fs.rm',
      params: {
        // App binaries only — engine stays under resources via sync/extract.
        path: 'runtime/music-server.exe'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'runtime/www'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'runtime/serve.js'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'runtime/COMMIT'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'cache/pinokio-app.zip'
      }
    },
    {
      method: 'shell.run',
      params: {
        message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-sync-app.ps1'
      }
    },
    {
      method: 'script.start',
      params: {
        // Fill engine if somehow missing after an old install.
        uri: 'install.js'
      }
    }
  ]
}
