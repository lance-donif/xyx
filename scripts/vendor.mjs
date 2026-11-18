import { build } from 'esbuild'
import { copyFile } from 'node:fs/promises'

const options = { bundle: true, minify: true, format: 'esm' }
await build({ ...options, entryPoints: ['node_modules/three/build/three.module.js'], outfile: 'vendor/three-r187.js' })
await build({
  ...options,
  entryPoints: ['node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'],
  external: ['three'],
  outfile: 'vendor/BufferGeometryUtils.js'
})
await copyFile('node_modules/three/LICENSE', 'vendor/THREE-LICENSE.txt')
