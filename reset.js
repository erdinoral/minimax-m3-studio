module.exports = {
  run: [
    {
      method: 'fs.rm',
      params: {
        path: 'app/node_modules'
      }
    },
    {
      method: 'fs.rm',
      params: {
        path: 'app/dist'
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
    }
  ]
}
