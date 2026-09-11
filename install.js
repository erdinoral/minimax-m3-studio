const fs = require('fs')
const path = require('path')

module.exports = async () => {
  const engineExe = path.resolve(__dirname, 'target/release/resources/minimaxmusic-cpp/mm-server.exe')
  const needEngine = !fs.existsSync(engineExe)

  const run = [
    {
      when: "{{platform !== 'win32'}}",
      method: 'notify',
      params: {
        html: 'This launcher targets <b>Windows 10/11 x64 + NVIDIA</b> (GTX 16 / RTX 20+). Other platforms are not supported yet.'
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
        message: [
          'powershell -NoProfile -Command "if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { Write-Error \'Rust/cargo not found. Install from https://rustup.rs then re-run Install.\'; exit 1 } else { cargo --version }"'
        ]
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
      html: "Install complete. Click <b>Start</b>. Music models download inside the app on first use."
    }
  })

  return { run }
}
