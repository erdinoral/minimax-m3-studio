module.exports = {
  run: [
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
