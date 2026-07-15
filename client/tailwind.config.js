/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0c0c12',
          800: '#14141c',
          700: '#1c1c28',
          600: '#2a2a38',
        },
        purple: {
          glow: '#9d6fd4',
          primary: '#6d28d9',
          dark: '#5b21b6',
          light: '#b794e8',
          muted: '#4c1d95',
        },
      },
      boxShadow: {
        glow: '0 0 16px rgba(109, 40, 217, 0.15)',
        'glow-sm': '0 0 8px rgba(109, 40, 217, 0.1)',
      },
    },
  },
  plugins: [],
};
