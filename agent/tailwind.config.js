/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pulled from the wireframe's CSS variables (Xclusive-Oman-Wireframes.html :root)
        ink: '#2b2b2b',
        line: '#9a9a9a',
        'line-light': '#c9c9c9',
        panel: '#f4f4f2',
        accent: '#b9502c',
        'accent-soft': '#f0d9cd',
        muted: '#8a8a8a',
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
        mono: ['SFMono-Regular', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        wf: '6px 6px 0 rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
