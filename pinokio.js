module.exports = {
  version: '8.0',
  title: 'MiniMax M3 Studio',
  description: 'Local MiniMax Music3 studio fork — generate full tracks on your NVIDIA GPU. Windows x64. https://github.com/erdinoral/minimax-m3-studio',
  icon: 'icon.png',
  pre: [{
    icon: 'https://www.rust-lang.org/static/images/rust-logo-blk.svg',
    title: 'Rust (cargo)',
    description: 'Needed once to build the local music-server. Install rustup, then re-open Install.',
    href: 'https://rustup.rs/'
  }],
  menu: async (kernel, info) => {
    const installed = info.exists('app/node_modules') && info.exists('target/release/music-server.exe')
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
          text: 'Terminal',
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
        icon: 'fa-solid fa-plug',
        text: 'Install',
        href: 'install.js'
      }, {
        icon: 'fa-regular fa-circle-xmark',
        text: 'Reset',
        href: 'reset.js'
      }]
    }

    return [{
      default: true,
      icon: 'fa-solid fa-plug',
      text: 'Install',
      href: 'install.js'
    }]
  }
}
