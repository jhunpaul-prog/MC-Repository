plugins: [require('tailwind-scrollbar')],
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./index.html",
      "./app/**/*.{js,ts,jsx,tsx}", // Adjust if needed
    ],
    theme: {
      extend: {
        colors: {
          maroon: "#800000", // You can change this to match your palette
        },
      },
    },
    plugins: [
      require('tailwind-scrollbar'),
    ],
  };
  