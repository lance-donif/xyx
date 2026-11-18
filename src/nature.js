import * as THREE from 'three'

const files = {
  grass: new URL('./art/grass.webp', import.meta.url).href,
  rock: new URL('./art/rock.webp', import.meta.url).href,
  asphalt: new URL('./art/asphalt.webp', import.meta.url).href,
  dirt: new URL('./art/dirt.webp', import.meta.url).href,
  bark: new URL('./art/bark.webp', import.meta.url).href,
  crown: new URL('./art/oak-foliage.webp', import.meta.url).href,
  spruce: new URL('./art/spruce-foliage.webp', import.meta.url).href,
  tuft: new URL('./art/meadow-tuft.webp', import.meta.url).href,
}

const textureLoader = new THREE.TextureLoader()
const textures = new Map()

function loadMap(name, repeat) {
  if (!textures.has(name)) {
    const texture = textureLoader.load(files[name])
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = repeat ? 8 : 2
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    textures.set(name, texture)
  }
  return textures.get(name)
}

// UVs are expressed in tile units so the same image can be shared by both routes.
export function terrainMap(name) {
  return loadMap(name, true)
}

const sectionSize = 84

// Crossed, slightly bowed leaf sprays retain thickness when viewed along the road or overhead.
export function createFoliageBatch(parent, materials = new Map()) {
  const bins = new Map()
  const visibleSections = []
  const n = new THREE.Vector3()

  function bucket(kind, z) {
    const section = Math.floor(-z / sectionSize)
    const key = kind + section
    if (!bins.has(key)) {
      bins.set(key, {kind, section, positions: [], normals: [], uv: [], colors: [], indices: []})
    }
    return bins.get(key)
  }

  function card(bin, x, y, z, rx, ry, rz, angle, cant, variant, mirror, tint) {
    const {positions, normals, uv, colors, indices} = bin
    const start = positions.length / 3
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const atlas = bin.kind !== 'tuft'
    const inset = .002
    // The centre bends out into space; virtual normals shade the canopy as a volume.
    for (const [u,v,bulge] of [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[.5,.52,.29]]) {
      const across = u * 2 - 1
      const tall = v * 2 - 1
      const inPlane = cant * tall + bulge
      const dx = cos * across - sin * inPlane
      const dz = sin * across + cos * inPlane
      positions.push(x + dx * rx, y + tall * ry, z + dz * rz)
      n.set(dx * .42, 1 + tall * .45, dz * .42).normalize()
      normals.push(n.x, n.y, n.z)
      const texU = mirror ? 1 - u : u
      uv.push(atlas ? (variant + inset + texU * (1-2*inset)) / 2 : texU, v)
      const intensity = tint * (bin.kind === 'tuft' ? .85 + .18*v : .78 + .31*v)
      colors.push(intensity, intensity, intensity)
    }
    for (let i = 0; i < 4; i++) indices.push(start+i, start+(i+1)%4, start+4)
  }

  // Accept both integral seeds and small floating seeds from seeded route generators.
  function variation(x,z,seed) {
    const value = Math.sin(x * 13.18 + z * 7.71 + seed * 54.21) * 43758.54
    return value - Math.floor(value)
  }
  function spray(kind, x,y,z,rx,ry,rz,seed,count,cant) {
    const bin = bucket(kind,z)
    const t = variation(x,z,seed)
    const rotation = (t-.5)*.92
    for(let i=0;i<count;i++) {
      const angle = rotation + i * Math.PI / count
      const variant = Math.floor(t*7 + (kind === 'crown' ? i : 0)) % 2
      card(bin,x,y,z,rx,ry,rz,angle,cant*(i%2?-1:1),variant,t>.48,.81+t*.30)
    }
  }

  function foliageMaterial(kind) {
    if (!materials.has(kind)) {
      const material = new THREE.MeshLambertMaterial({
        map: loadMap(kind, false), vertexColors: true, alphaTest: kind === 'spruce' ? .19 : kind === 'tuft' ? .25 : .31,
        side: THREE.DoubleSide,
      })
      // Translucent foliage receives the same broad light on either face of the spray.
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
          '#include <normal_fragment_begin>\nnormal *= faceDirection;')
      }
      materials.set(kind,material)
    }
    return materials.get(kind)
  }

  return {
    crown(x,y,z,rx,ry,rz,seed=1) {
      spray('crown',x,y,z,rx,ry,rz,seed,3,.31)
    },
    conifer(x,y,z,rx,height,rz,seed=1) {
      spray('spruce',x,y+height*.5,z,rx,height*.5,rz,seed,1,.045)
    },
    tuft(x,y,z,width,height,seed=1) {
      spray('tuft',x,y+height*.48,z,width*.5,height*.5,width*.5,seed,2,.16)
    },
    flush() {
      for (const bin of bins.values()) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(bin.positions,3))
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(bin.normals,3))
        geo.setAttribute('color', new THREE.Float32BufferAttribute(bin.colors,3))
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(bin.uv,2))
        geo.setIndex(bin.indices)
        geo.computeBoundingSphere()
        const mesh = new THREE.Mesh(geo, foliageMaterial(bin.kind))
        mesh.name = 'Foliage · ' + bin.kind
        mesh.castShadow = bin.kind !== 'tuft'
        parent.add(mesh)
        visibleSections.push({mesh, start:bin.section*sectionSize, range:bin.kind==='tuft'?115:510})
      }
      bins.clear()
    },
    update(s) {
      for (const {mesh,start,range} of visibleSections) {
        mesh.visible = s >= start-range && s <= start+sectionSize+65
      }
    },
  }
}
