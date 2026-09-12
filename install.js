const fs = require('fs')
const path = require('path')

// H3-style: build from this GitHub repo. Engine weights are the only big download.
const PORTABLE_URL = 'https://github.com/timoncool/MiniMax-Music3-Studio/releases/download/v1.5.1/MiniMax-Music3-Studio-1.5.1-portable.zip'

module.exports = async () => {
  const engineReady = fs.existsSync(path.resolve(__dirname, 'resources/minimaxmusic-cpp/mm-server.exe'))
    || fs.existsSync(path.resolve(__dirname, 'runtime/resources/minimaxmusic-cpp/mm-server.exe'))

  const run = [
    {
      method: 'shell.run',
      params: {
        message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-build.ps1'
      }
    }
  ]

  if (!engineReady) {
    run.push(
      {
        method: 'fs.download',
        params: {
          uri: PORTABLE_URL,
          path: 'cache/MiniMax-Music3-Studio-portable.zip'
        }
      },
      {
        method: 'shell.run',
        params: {
          message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-extract-engine.ps1'
        }
      }
    )
  } else {
    run.push({
      method: 'shell.run',
      params: {
        message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-extract-engine.ps1'
      }
    })
  }

  run.push({
    method: 'notify',
    params: { html: 'Ready. Click <b>Start</b>. Later updates: <b>Update</b> = git pull + rebuild (like H3).' }
  })

  return { run }
}
