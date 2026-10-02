// Local portable build preview. The published launcher can later install the
// same layout under runtime/ without changing how the application starts.
module.exports = {
  run: [{
    method: 'shell.run',
    params: {
      message: 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pinokio-start-desktop.ps1'
    }
  }]
}
