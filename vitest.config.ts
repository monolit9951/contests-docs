import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Theme units plus ordinary build/deploy script units. The anti-doorway
        // test is a legacy standalone self-check that calls process.exit(), so
        // npm runs that one separately after Vitest (see package.json).
        include: ['docs/.vitepress/**/*.test.ts', 'scripts/*.test.mjs'],
        exclude: ['scripts/anti_doorway_lint.test.mjs'],
        // Pure functions only — path/url classification and scroll geometry.
        // Anything that needs a DOM belongs in the browser, not in a fake one:
        // the beacon must never be the reason a page breaks, so its
        // window-bound wrappers stay thin enough to read instead of mock.
        environment: 'node',
    },
})
