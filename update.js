// Same idea as MiniMax H3 Studio: pull this GitHub repo, rebuild from source.
module.exports = {
  run: [
    {
      method: 'shell.run',
      params: {
        message: 'git pull'
      }
    },
    {
      method: 'shell.run',
      params: {
        message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-build.ps1'
      }
    },
    {
      method: 'notify',
      params: { html: 'Updated from GitHub. Click <b>Start</b>.' }
    }
  ]
}
