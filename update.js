const fs = require('fs')
const path = require('path')

module.exports = async () => {
  const engineExe = path.resolve(__dirname, 'target/release/resources/minimaxmusic-cpp/mm-server.exe')
  const needEngine = !fs.existsSync(engineExe)

  const run = [
    {
      method: 'shell.run',
      params: {
        message: 'git pull'
      }
    },
    {
      method: 'shell.run',
      params: {
        path: 'app',
        message: 'npm install'
      }
    },
    {
      method: 'shell.run',
      params: {
        message: 'cargo build -p music-server --release'
      }
    }
  ]

  if (needEngine) {
    run.push(
      {
        method: 'fs.download',
        params: {
          uri: 'https://github.com/timoncool/MiniMax-Music3-Studio/releases/download/v1.5.1/MiniMax-Music3-Studio-1.5.1-portable.zip',
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

  run.push({
    method: 'notify',
    params: {
      html: 'Update complete.'
    }
  })

  return { run }
}
