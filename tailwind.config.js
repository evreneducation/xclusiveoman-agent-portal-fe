/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pulled from the wireframe's CSS variables (Xclusive-Oman-Wireframes.html :root)
        // — used by the Admin Console only (src/admin/**). Do not repurpose these
        // for the Agent Portal; it has its own `agent-*` palette below so the two
        // portals stay visually distinct per-portal without a second Tailwind build.
        ink: '#2b2b2b',
        line: '#9a9a9a',
        'line-light': '#c9c9c9',
        panel: '#f4f4f2',
        accent: '#b9502c',
        'accent-soft': '#f0d9cd',
        muted: '#8a8a8a',

        // Agent Portal — a travel-themed "ocean + sand + gold" identity, kept
        // deliberately distinct from the Admin Console's charcoal/terracotta
        // palette above. Used only by src/agent/** components.
        'agent-ink': '#0b4f4a',
        'agent-ink-dark': '#083a36',
        'agent-line': '#a9c2bf',
        'agent-line-light': '#dbe7e4',
        'agent-panel': '#eef6f4',
        'agent-bg': '#f7f4ec',
        'agent-accent': '#e2a33b',
        'agent-accent-dark': '#c98a24',
        'agent-accent-soft': '#faf0da',
        'agent-muted': '#6b8481',
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
