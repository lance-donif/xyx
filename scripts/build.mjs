import { cp } from 'node:fs/promises'
import { build } from 'vite'

// Keep the same import map in the standalone build and the repository-root site.
await build({ base: './', build: { rollupOptions: { input: { main: "index.html", chase: "chase.html" }, external: ['three', 'three/addons/utils/BufferGeometryUtils.js'] } } })
await cp('vendor', 'dist/vendor', { recursive: true })
await cp('src/fonts/OFL.txt', 'dist/assets/Barlow-OFL.txt')
