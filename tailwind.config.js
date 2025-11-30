/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"  // <--- THIS catches App.tsx and index.tsx in the root!
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}