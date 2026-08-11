/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sand: '#C2B280',
        'dark-bg': '#000000',
        'dark-secondary': '#1a1a1a',
        'dark-tertiary': '#2a2a2a',
        'dark-border': '#3a3a3a',
        'dark-text': '#ffffff',
        'dark-text-secondary': '#e0e0e0',
        'dark-text-tertiary': '#a0a0a0',
      },
    },
  },
  plugins: [],
}
