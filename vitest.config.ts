import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Theme units plus ordinary build/deploy script units. The anti-doorway
        // anti-doorway and product-truth are standalone mutation self-checks,
        // so npm runs them separately after Vitest (see package.json).
        include: ['docs/.vitepress/**/*.test.ts', 'scripts/*.test.mjs'],
        exclude: [
            'scripts/anti_doorway_lint.test.mjs',
            'scripts/product-truth-lint.test.mjs',
        ],
        // Pure functions only — path/url classification and scroll geometry.
        // Anything that needs a DOM belongs in the browser, not in a fake one:
        // the beacon must never be the reason a page breaks, so its
        // window-bound wrappers stay thin enough to read instead of mock.
        environment: 'node',
    },
})
