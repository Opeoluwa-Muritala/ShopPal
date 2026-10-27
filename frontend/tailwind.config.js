/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#EFF5FF',
          100: '#DDEBFF',
          200: '#BFD4FF',
          300: '#8EA9F4',
          400: '#5D83DB',
          500: '#2A52BE',
          600: '#0054B4',
          700: '#00489A',
          800: '#003C7A',
          900: '#003153',
          950: '#001A30',
        },
        naija: {
          50: '#EFF5FF',
          100: '#DDEBFF',
          200: '#BFD4FF',
          300: '#8EA9F4',
          400: '#5D83DB',
          500: '#2A52BE',
          600: '#0054B4',
          700: '#00489A',
          800: '#003C7A',
          900: '#003153',
          950: '#001A30',
        },
        accent: {
          darkest: '#003153',
          primary: '#2A52BE',
          medium: '#0054B4',
          sand: '#DDEBFF',
          taupe: '#8EA9F4',
        },
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        'float-delay': 'float 3.5s ease-in-out infinite 0.5s',
      },
    },
  },
  plugins: [],
};
