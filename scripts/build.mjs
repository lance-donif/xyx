import { cp } from 'node:fs/promises'
import { build } from 'vite'

// Keep the same import map in the standalone build and the repository-root site.
await build({ base: './', build: { rollupOptions: { external: ['three', 'three/addons/utils/BufferGeometryUtils.js'] } } })
await cp('vendor', 'dist/vendor', { recursive: true })
