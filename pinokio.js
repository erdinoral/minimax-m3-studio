module.exports = {
  version: '8.0',
  title: 'MiniMax M3 Studio',
  description: 'Local MiniMax Music3 studio — one click on Windows + NVIDIA. https://github.com/erdinoral/minimax-m3-studio',
  icon: 'icon.png',
  menu: async (kernel, info) => {
    const installed = info.exists('runtime/music-server.exe')
      && info.exists('runtime/www/index.html')
      && info.exists('runtime/resources/minimaxmusic-cpp/mm-server.exe')
    const running = {
      install: info.running('install.js'),
      start: info.running('start.js'),
      update: info.running('update.js'),
      reset: info.running('reset.js')
    }

    if (running.install) {
      return [{
        default: true,
        icon: 'fa-solid fa-plug',
        text: 'Installing',
        href: 'install.js'
      }]
    }

    if (installed) {
      if (running.start) {
        const local = info.local('start.js')
        if (local && local.url) {
          return [{
            default: true,
            icon: 'fa-solid fa-rocket',
            text: 'Open Web UI',
            href: local.url
          }, {
            icon: 'fa-solid fa-terminal',
            text: 'Terminal',
            href: 'start.js'
          }]
        }
        return [{
          default: true,
          icon: 'fa-solid fa-terminal',
          text: 'Starting...',
          href: 'start.js'
        }]
      }

      if (running.update) {
        return [{
          default: true,
          icon: 'fa-solid fa-terminal',
          text: 'Updating',
          href: 'update.js'
        }]
      }

      if (running.reset) {
        return [{
          default: true,
          icon: 'fa-solid fa-terminal',
          text: 'Resetting',
          href: 'reset.js'
        }]
      }

      return [{
        default: true,
        icon: 'fa-solid fa-power-off',
        text: 'Start',
        href: 'start.js'
      }, {
        icon: 'fa-solid fa-plug',
        text: 'Update',
        href: 'update.js'
      }, {
        icon: 'fa-regular fa-circle-xmark',
        text: 'Reset',
        href: 'reset.js'
      }]
    }

    // First open: auto-run Install (downloads runtime, no npm for the user).
    return [{
      default: true,
      icon: 'fa-solid fa-plug',
      text: 'Install',
      href: 'install.js'
    }]
  }
}
