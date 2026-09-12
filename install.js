const fs = require('fs')
const path = require('path')

// Prebuilt UI + music-server. Rebuilt by GitHub Actions on every push to main
// (workflow: pinokio-runtime.yml) and published to this release tag.
const APP_ZIP = 'https://github.com/erdinoral/minimax-m3-studio/releases/download/pinokio-runtime-v2/pinokio-app.zip'
const PORTABLE_URL = 'https://github.com/timoncool/MiniMax-Music3-Studio/releases/download/v1.5.1/MiniMax-Music3-Studio-1.5.1-portable.zip'

module.exports = async () => {
  const ready = fs.existsSync(path.resolve(__dirname, 'runtime/music-server.exe'))
    && fs.existsSync(path.resolve(__dirname, 'runtime/www/index.html'))
    && fs.existsSync(path.resolve(__dirname, 'runtime/serve.js'))
  const engineReady = fs.existsSync(path.resolve(__dirname, 'runtime/resources/minimaxmusic-cpp/mm-server.exe'))

  const run = []

  if (!ready) {
    run.push(
      {
        method: 'fs.download',
        params: {
          uri: APP_ZIP,
          path: 'cache/pinokio-app.zip'
        }
      },
      {
        method: 'shell.run',
        params: {
          message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-extract-app.ps1'
        }
      }
    )
  }

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
  }

  if (run.length === 0) {
    run.push({
      method: 'notify',
      params: { html: 'Already installed. Click <b>Start</b> — it will pull GitHub updates automatically.' }
    })
  } else {
    run.push({
      method: 'notify',
      params: { html: 'Ready. Click <b>Start</b> to open the studio.' }
    })
  }

  return { run }
}
