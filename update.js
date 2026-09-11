const fs = require('fs')
const path = require('path')

const SERVER_URL = 'https://github.com/erdinoral/minimax-m3-studio/releases/download/pinokio-runtime-v1/music-server.exe'
const PORTABLE_URL = 'https://github.com/timoncool/MiniMax-Music3-Studio/releases/download/v1.5.1/MiniMax-Music3-Studio-1.5.1-portable.zip'

module.exports = async () => {
  const serverExe = path.resolve(__dirname, 'runtime/music-server.exe')
  const engineExe = path.resolve(__dirname, 'runtime/resources/minimaxmusic-cpp/mm-server.exe')
  const needServer = !fs.existsSync(serverExe)
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
        message: [
          'npm install',
          'npm run build'
        ]
      }
    }
  ]

  if (needServer) {
    run.push({
      method: 'fs.download',
      params: {
        uri: SERVER_URL,
        path: 'runtime/music-server.exe'
      }
    })
  }

  if (needEngine) {
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

  run.push({
    method: 'notify',
    params: {
      html: 'Update complete.'
    }
  })

  return { run }
}
