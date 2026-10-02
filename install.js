const fs = require('fs')
const path = require('path')

// H3-style: build from this GitHub repo. Engine weights are the only big download.
const PORTABLE_VERSION = '3.4.0'
const PORTABLE_URL = `https://github.com/timoncool/MiniMax-Music3-Studio/releases/download/v${PORTABLE_VERSION}/MiniMax-Music3-Studio-${PORTABLE_VERSION}-portable.zip`
const PORTABLE_ZIP = `cache/MiniMax-Music3-Studio-${PORTABLE_VERSION}-portable.zip`

module.exports = async () => {
  // The engine with per-CUDA backend folders; an older flat engine is refreshed.
  const engineReady = fs.existsSync(path.resolve(__dirname, 'resources/minimaxmusic-cpp/cuda13/ggml-cuda.dll'))

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
          path: PORTABLE_ZIP
        }
      },
      {
        method: 'shell.run',
        params: {
          message: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-extract-engine.ps1 -Zip ${PORTABLE_ZIP}`
        }
      }
    )
  }

  run.push({
    method: 'notify',
    params: { html: 'Ready. Click <b>Start</b>. Later updates: <b>Update</b> = git pull + rebuild (like H3).' }
  })

  return { run }
}
