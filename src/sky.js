import {
  CanvasTexture, Color, EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader
} from 'three'

const urls = {
  day: new URL('./assets/sky/day.webp', import.meta.url).href,
  dusk: new URL('./assets/sky/dusk.webp', import.meta.url).href
}
const cache = new Map()
const loader = new TextureLoader()
let mounts = 0

function loadSky(mode) {
  if (!cache.has(mode)) {
    const pending = loader.loadAsync(urls[mode]).then(background => {
      background.colorSpace = SRGBColorSpace
      background.mapping = EquirectangularReflectionMapping

      // Rough surfaces only need low spatial frequencies. Use a small separate
      // source so the renderer's filtered metal reflections stay cheap on phones.
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 128
      canvas.getContext('2d').drawImage(background.image, 0, 0, 256, 128)
      const environment = new CanvasTexture(canvas)
      environment.colorSpace = SRGBColorSpace
      environment.mapping = EquirectangularReflectionMapping
      return { background, environment }
    })
    cache.set(mode, pending)
  }
  return cache.get(mode)
}

export function mountSky(scene, route = 'alpine') {
  let active = true
  let current
  let ready
  mounts++
  function setTheme(mode) {
    const theme = mode === 'dusk' ? 'dusk' : 'day'
    if (!active || current === theme) return ready
    current = theme
    if (!scene.background?.isTexture) scene.background = new Color(theme === 'day' ? '#92bed9' : '#ee9b75')
    ready = loadSky(theme).then(({ background, environment }) => {
      if (!active || current !== theme) return
      scene.background = background
      scene.environment = environment
      // Orient the photographed light toward the lit side of each course.
      const light = scene.getObjectByProperty('isDirectionalLight', true)
      const lightAzimuth = light ? Math.atan2(light.position.z, light.position.x) : (route === 'coast' ? -2.13 : -0.84)
      const sunAzimuth = theme === 'day' ? 0.596 : 1.01
      scene.backgroundRotation.y = sunAzimuth - lightAzimuth
      scene.environmentRotation.copy(scene.backgroundRotation)
      scene.environmentIntensity = theme === 'day' ? 0.62 : 0.72
      scene.dispatchEvent({ type: 'skychange' })
    }).catch(error => console.warn('Sky panorama could not be loaded', error))
    return ready
  }
  setTheme('day')
  return {
    get ready() { return ready },
    setTheme,
    dispose() {
      if (!active) return
      active = false
      scene.background = null
      scene.environment = null
      if (--mounts === 0) {
        for (const pending of cache.values()) {
          pending.then(({ background, environment }) => {
            background.dispose()
            environment.dispose()
          }, () => {})
        }
        cache.clear()
      }
    }
  }
}
