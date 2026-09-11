/**
 * The studio ships its own Tailwind build. The previous CDN script could not
 * work in the packaged desktop app: it needs the network at every launch and
 * violates the shell's content-security policy.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './context/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        suno: {
          DEFAULT: '#121214',
          sidebar: '#121214',
          panel: '#121214',
          card: '#18181b',
          hover: '#27272a',
          border: '#27272a',
        },
        // Spotify-like brand green for CTAs, playing state, focus.
        brand: {
          DEFAULT: '#1DB954',
          soft: '#1ed760',
          deep: '#169c46',
          muted: 'rgba(29, 185, 84, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
          '50%': { 'background-size': '200% 200%', 'background-position': 'right center' },
        },
      },
    },
  },
  plugins: [],
};
