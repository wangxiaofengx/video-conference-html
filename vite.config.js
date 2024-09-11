import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		emptyOutDir: true
	},
	plugins: [
		vue(),
	],
	base: './',
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},
	server: {
		host: '0.0.0.0',
		proxy: {
			'/video': {
				target: "http://192.168.8.75:9900",
			}
		}
	}
})
