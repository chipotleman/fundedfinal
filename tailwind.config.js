module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  future: {
    // Per replit.md: no hover effects on touch devices. With this flag, every
    // Tailwind `hover:` utility is wrapped in `@media (hover: hover)` so it
    // only applies on devices that actually have a real pointer.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
