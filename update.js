module.exports = {
  run: [
    {
      method: 'shell.run',
      params: {
        message: 'git pull'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'runtime'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'cache'
      }
    },
    {
      method: 'script.start',
      params: {
        uri: 'install.js'
      }
    }
  ]
}
