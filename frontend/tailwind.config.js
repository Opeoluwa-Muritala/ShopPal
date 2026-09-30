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
        cool: {
          50: '#f4f7fa',
          100: '#e7eef5',
          200: '#cfdeeb',
          500: '#607b96',
          600: '#506b86',
          700: '#40566f',
          800: '#30445b',
          900: '#203247',
        },
        naija: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
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
