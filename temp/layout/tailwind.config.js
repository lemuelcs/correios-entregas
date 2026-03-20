/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        correios: {
          blue:       '#003399',
          'blue-dark':'#002266',
          'blue-mid': '#0040C0',
          'blue-light':'#1A4DB3',
          'blue-50':  '#E6EBF7',
          'blue-100': '#C0CFED',
          yellow:     '#FFD600',
          'yellow-dark':'#E6C000',
          'yellow-50':'#FFFDE0',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
        'card-lg': '0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
