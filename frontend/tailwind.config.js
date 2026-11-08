/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f8ff',
          200: '#b9f0ff',
          300: '#7fe3ff',
          400: '#36ccff',
          500: '#09b3ff',
          600: '#0092e6',
          700: '#0074ba',
          800: '#006299',
          900: '#00507d',
          950: '#00324d',
        },
      },
      boxShadow: {
        glow: '0 40px 80px -60px rgb(9 179 255 / 0.9)',
        'glow-cyan': '0 40px 80px -60px rgb(34 211 238 / 0.9)',
      },
    },
  },
  plugins: [],
}
