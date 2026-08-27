/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Admin Console palette — used only by src/admin/**. Whole-admin
        // colour-system pass: retinted from the original charcoal/terracotta
        // pairing onto the blue/indigo/purple "modern SaaS dashboard" palette
        // the CMS pages introduced first, so every existing admin page that
        // uses these same token names (text-accent, bg-panel, border-line-light,
        // text-muted, …) re-themes consistently in one place rather than
        // needing per-page edits. Same token names throughout, so no markup
        // changed — only what each token resolves to. The Agent Portal has
        // its own separate `agent-*` palette (unchanged) so the two portals
        // stay visually distinct per-portal without a second Tailwind build.
        ink: '#172554',
        'ink-dark': '#0F1B4D',
        line: '#A5B4D9',
        'line-light': '#E4E9FB',
        panel: '#F3F4FF',
        accent: '#4F46E5',
        'accent-soft': '#E0E7FF',
        'accent-dark': '#3730A3',
        muted: '#64748B',

        // Agent Portal — a travel-themed "ocean + sunset over the dunes"
        // identity, deliberately different colour codes from the Admin
        // Console's navy/indigo/purple palette above (teal/emerald ocean
        // tones + gold/coral sunset accents instead), so the two portals
        // keep reading as distinct apps while both get the same "colourful,
        // modern, premium" treatment. Same token names as before — only the
        // hex values were enriched — so no agent markup needed to change
        // for this to take effect anywhere they're already used. Used only
        // by src/agent/** components.
        //
        // agent-ink/agent-ink-dark were later lightened from a near-black
        // teal (#0B4F4A/#083A36) to Tailwind's own teal-700/teal-800 — same
        // hue family (this was already a teal, not a true forest green), just
        // materially brighter, since the original read as "very dark" across
        // every heading/body-text/icon on the portal. Still comfortably
        // AA-compliant for body text on white (teal-700 ≈ 5.4:1, teal-800 ≈
        // 7.1:1 — both above the 4.5:1 minimum), and the two still keep their
        // original darker/lighter relationship to each other. Every other
        // token below (borders, panels, background, gold accent, muted text)
        // was already light/neutral enough that it wasn't part of the "too
        // dark" complaint, so those are untouched.
        // Brand-guideline pass (Europa Nuova / #FFC15A yellow): headings
        // #1C1C1C, body #222222, and a single warm yellow accent used for
        // highlights, lines, decorative elements and the sidebar. "Lighter
        // text" is opacity on these two inks, never a separate grey — so
        // agent-muted is just a mid-grey approximation of #222 for the rare
        // caller that needs a solid token instead of a /opacity utility.
        // Every agent page already reads through these token names, so this
        // one edit re-themes the whole portal; the sidebar's own hardcoded
        // gold hexes are swapped to match in AgentLayout.jsx.
        'agent-ink': '#222222',
        'agent-ink-dark': '#1C1C1C',
        'agent-line': '#FFC15A',
        'agent-line-light': '#F1DDB8',
        'agent-panel': '#FFF7EA',
        'agent-bg': '#FDF8ED',
        'agent-accent': '#FFC15A',
        'agent-accent-dark': '#E9A63D',
        'agent-accent-soft': '#FFF1D9',
        'agent-muted': '#6B6B6B',

        // Team Portal (/team) — Lead Managers (sales_manager) and
        // Relationship Managers (relationship_manager) sign in here, never
        // into the full Admin Console or Agent Portal. A third, deliberately
        // distinct identity from both above — slate charcoal + a rose/crimson
        // accent ("executive slate & rose"), so someone glancing at either
        // sidebar can never mistake this for Admin's navy/indigo/purple or
        // Agent's teal/gold. Used only by src/team/**.
        'team-ink': '#1E2532',
        'team-ink-dark': '#12161F',
        'team-line': '#A8AEBB',
        'team-line-light': '#E4E7EC',
        'team-panel': '#F7F5F6',
        'team-bg': '#FBFAFA',
        'team-accent': '#BE123C',
        'team-accent-dark': '#881337',
        'team-accent-soft': '#FCE4E9',
        'team-muted': '#6B7280',
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
        mono: ['SFMono-Regular', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
        // Agent Portal brand fonts (see @font-face in src/index.css and the
        // .woff2 files expected under public/fonts/). `agent` is the body +
        // heading face (Europa Nuova, weights 400/700/800); `agent-highlight`
        // is the Canela Medium Italic display face used only for highlighted
        // text. Applied portal-wide via `font-agent` on the agent root in
        // agent/App.jsx, so every agent page inherits it without per-element
        // classes; the admin and team portals keep the default `sans` stack.
        agent: ['"Europa Nuova"', 'Helvetica', 'Arial', 'sans-serif'],
        'agent-highlight': ['"Canela"', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        wf: '6px 6px 0 rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
