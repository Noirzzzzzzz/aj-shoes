/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { primary: "#22d3ee" } } } },
  plugins: [],
}
