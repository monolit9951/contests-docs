import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Only the theme's own unit tests. `scripts/*.test.mjs` (the content
        // fleet's anti-doorway linter test) is a standalone self-checking
        // script that ends in `process.exit(0)` — vitest reads that exit as a
        // crashed suite. It stays on its own runner; `npm test` invokes it
        // after this, see package.json.
        include: ['docs/.vitepress/**/*.test.ts'],
        // Pure functions only — path/url classification and scroll geometry.
        // Anything that needs a DOM belongs in the browser, not in a fake one:
        // the beacon must never be the reason a page breaks, so its
        // window-bound wrappers stay thin enough to read instead of mock.
        environment: 'node',
    },
})
