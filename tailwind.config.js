/** @type {import('tailwindcss').Config} */
module.exports = {
<<<<<<< HEAD
  content: [
    './index.html',
    './app/**/*.{js,ts,jsx,tsx}', // adjust if your paths differ
  ],

  theme: {
    extend: {
      /* 1 ▸ brand colours */
      colors: {
        maroon: {
          DEFAULT: '#800000', // use `text-maroon`, `bg-maroon`
          dark:    '#640000', // use `hover:bg-maroon-dark`
=======
    content: [
      "./index.html",
      "./app/**/*.{js,ts,jsx,tsx}", // Adjust if needed
    ],
    theme: {
      extend: {
        colors: {
          maroon: "#800000", // You can change this to match your palette
          black: "#000000ff",
>>>>>>> 3ff3a2cb0191ee7d18ebda10fbdcaeeea972ae78
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
