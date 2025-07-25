/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './app/**/*.{js,ts,jsx,tsx}', // adjust if your paths differ
  ],

  theme: {
    extend: {
      keyframes: {
      fadeIn: {
        '0%': { opacity: '0', transform: 'translateY(-4px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
    },
    animation: {
      fadeIn: 'fadeIn 0.3s ease-out forwards',
    },
      /* 1 ▸ brand colours */
      colors: {
        maroon: {
          DEFAULT: '#800000', // use `text-maroon`, `bg-maroon`
          dark:    '#640000', // use `hover:bg-maroon-dark`

        },
      },

      /* 2 ▸ custom shadows */
      boxShadow: {
        menu: '0 4px 12px rgba(0,0,0,0.12)',
      },
    },
  },

  /* 3 ▸ plugins */
  plugins: [
    require('tailwind-scrollbar'),
  ],
};
