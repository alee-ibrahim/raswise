import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// See https://svelte.dev/docs/kit/integrations for more information about preprocessors
			preprocess: vitePreprocess(),
			adapter: adapter(),
			csrf: {
				// Equivalent of the removed `checkOrigin: false`
				trustedOrigins: ['*']
			}
		})
	]
});
