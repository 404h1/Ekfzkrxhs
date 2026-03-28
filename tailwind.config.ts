import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '10%': { transform: 'translateX(-8px) rotate(-1deg)' },
          '20%': { transform: 'translateX(8px) rotate(1deg)' },
          '30%': { transform: 'translateX(-8px) rotate(-1deg)' },
          '40%': { transform: 'translateX(8px) rotate(1deg)' },
          '50%': { transform: 'translateX(-4px)' },
          '60%': { transform: 'translateX(4px)' },
          '70%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
          '90%': { transform: 'translateX(-2px)' },
        },
        floatUpDown: {
          '0%, 100%': { transform: 'translate(-50%, -50%) translateY(0px)' },
          '50%': { transform: 'translate(-50%, -50%) translateY(-12px)' },
        },
        glitchFlicker: {
          '0%, 100%': { textShadow: '2px 0 #ff0000, -2px 0 #00ffff', opacity: '1' },
          '25%': { textShadow: '-2px 0 #ff0000, 2px 0 #00ffff', opacity: '0.9' },
          '50%': { textShadow: '3px 2px #ff0000, -3px -2px #00ffff', opacity: '1' },
          '75%': { textShadow: '-3px 2px #ff0000, 3px -2px #00ffff', opacity: '0.95' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shake: 'shake 0.6s ease-in-out',
        'float-item': 'floatUpDown 2s ease-in-out infinite',
        'glitch-flicker': 'glitchFlicker 0.15s infinite',
        scanline: 'scanline 3s linear infinite',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
export default config
