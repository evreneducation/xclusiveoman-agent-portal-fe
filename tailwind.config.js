/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Admin Console palette — used only by src/admin/**. Retinted from the
        // original wireframe's flat black/grey to the deep-navy brand color
        // used in the master documentation (title/table-header navy), paired
        // with a warmer accent — while keeping the same token names so every
        // existing admin component re-themes without further edits. The Agent
        // Portal has its own separate `agent-*` palette so the two portals
        // stay visually distinct per-portal without a second Tailwind build.
        ink: '#16233f',
        'ink-dark': '#0d1626',
        line: '#94a0b8',
        'line-light': '#dce1ec',
        panel: '#f2f4f9',
        accent: '#d1642f',
        'accent-soft': '#fbe1cf',
        muted: '#69728a',

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
