import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	splitting: false,
	sourcemap: true,
	clean: true,
	replaceNodeEnv: true,
	shims: true,
	treeshake: true,
	plugins: [],
	dts: true,
})
