/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f2',
          100: '#fee2e3',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#da020f',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        gray: {
          50: '#fdf5f5',
          100: '#f5e6e6',
          200: '#e8cccc',
          300: '#c9a3a3',
          400: '#a88888',
          500: '#8a6666',
          600: '#6b4a4a',
          700: '#4d3333',
          800: '#362222',
          900: '#251515',
          950: '#180c0c',
        },
      },
      fontFamily: {
        bebas: ['"Bebas Neue"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
