import * as THREE from 'three'

const CELL = 256
const ATLAS = CELL * 4
const plots = [
  '#e2d9bc', '#edc57d', '#dba77c', '#f3e3c0',
  '#ece1c7', '#dbcaac', '#cfb38a', '#eee6c8',
]

function randomSequence(initial) {
  let state = initial
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function villageAtlas() {
  const random = randomSequence(50819)
  function surface() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = ATLAS
    return canvas.getContext('2d')
  }
  const ink = surface()
  const glow = surface()
  glow.fillStyle = 'black'
  glow.fillRect(0, 0, ATLAS, ATLAS)

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  function stroke(ctx, x, y, xx, yy, width, color) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(xx, yy)
    ctx.stroke()
  }
  function timber(x, y, xx, yy, width) {
    stroke(ink, x + 1, y + 1.4, xx + 1, yy + 1.4, width + 1.5, 'rgba(65,36,19,.45)')
    stroke(ink, x, y, xx, yy, width, '#513c2b')
    stroke(ink, x - .5, y - .5, xx - .5, yy - .5, .6, '#947a58')
  }
  function window(x, y, w, h, variant, shutter, flowers) {
    const dark = ['#315340','#435a58','#774737','#566445'][variant % 4]
    rect(ink, x-3, y-3, w+6, h+7, '#8c7257')
    rect(ink, x-1.5, y-1.5, w+3, h+3, '#d3bb8f')
    rect(ink, x, y, w, h, '#36434a')
    const gradient=ink.createLinearGradient(x,y,x+w*.8,y+h)
    gradient.addColorStop(0, '#88a1a4')
    gradient.addColorStop(.37, '#647c81')
    gradient.addColorStop(.45, '#38484b')
    gradient.addColorStop(1, '#49453b')
    rect(ink,x+1.2,y+1.2,w-2.4,h-2.4,gradient)
    const lit=random()
    const lamp=glow.createLinearGradient(x,y,x+w*.45,y+h)
    const warm=lit>.50, low=lit<.24
    lamp.addColorStop(0,low?'#281b14':warm?'#ffdca2':'#c78e5e')
    lamp.addColorStop(1,low?'#362a20':warm?'#edac6a':'#8e6041')
    rect(glow,x+1.2,y+1.2,w-2.4,h-2.4,lamp)
    for (const ctx of [ink,glow]) {
      const bar = ctx===ink ? '#c7bca2' : '#241a12'
      rect(ctx,x+w*.48,y,1.6,h,bar)
      rect(ctx,x,y+h*.48,w,1.7,bar)
      rect(ctx,x,y+h*.76,w,1,bar)
    }
    if (shutter) {
      for (const dx of [x-w*.42-3,x+w+3]) {
        rect(ink,dx,y,w*.42,h,dark)
        for(let j=3;j<h-1;j+=3.5) rect(ink,dx+.8,y+j,w*.42-1.6,.8,'rgba(17,30,22,.5)')
        rect(ink,dx,y,w*.42,1,'#ad986d')
      }
    }
    rect(ink,x-4,y+h+1,w+8,3,'#ab926f')
    if (flowers) {
      rect(ink,x-3,y+h,w+6,4,'#725035')
      for (let i=0;i<40;i++) {
        const px=x-2+random()*(w+4),py=y+h-3+random()*6
        rect(ink,px,py,1.5+random()*2.5,2,random()<.72?'#41623b':random()<.5?'#c74c48':'#da7872')
      }
    }
  }

  function plaster(tile) {
    rect(ink,0,0,CELL,CELL,plots[tile % plots.length])
    for (let i=0;i<4100;i++) {
      const x=random()*CELL, y=random()*CELL, size=.5+random()*2.2
      rect(ink,x,y,size,size*.66,random()<.5?'rgba(89,64,42,.065)':'rgba(255,244,198,.24)')
    }
    const weather=ink.createLinearGradient(0,0,0,CELL)
    weather.addColorStop(0,'rgba(68,46,24,.30)')
    weather.addColorStop(.09,'rgba(75,52,33,0)')
    weather.addColorStop(.84,'rgba(80,55,36,0)')
    weather.addColorStop(1,'rgba(82,60,42,.25)')
    rect(ink,0,0,CELL,CELL,weather)
  }
  function facade(i) {
    plaster(i)
    const halfTimber = i !== 2 && i!==5
    if (halfTimber) {
      for (const y of [4,97,160,251]) timber(0,y,CELL,y,y===160?7:4)
      for (const x of [3,85,171,253]) timber(x,0,x,CELL,5)
      for (const x of [0,86,171]) {
        timber(x+4,96,x+20,59,4.2)
        timber(x+78,96,x+62,61,4.2)
        timber(x+3,102,x+24,154,3.5)
        timber(x+80,102,x+59,154,3.5)
      }
    } else {
      rect(ink,0,157,256,6,'#bdac8c')
      rect(ink,0,155,256,3,'#f1dcad')
    }
    for(let j=0;j<3;j++) {
      const x=43+j*85
      window(x-14,32,28,43,i,true,i%3!==0)
      window(x-11,111,22,31,i,false,false)
      if(j!==1) window(x-14,184,28,41,i,true,i%2===0)
    }
    const doorX = 110
    rect(ink,doorX-4,181,43,75,'#b5a17e')
    const doorTone=i%2===0?'#594a3a':'#536554'
    rect(ink,doorX,185,35,71,doorTone)
    for(const y of [192,218]) {
      rect(ink,doorX+5,y,25,20,'#3e4238')
      rect(ink,doorX+7,y+2,21,16,doorTone)
    }
    rect(ink,doorX+27,224,3,2,'#d9b675')
    rect(ink,doorX-6,251,47,5,'#a79c87')
  }
  function roof(i) {
    const colors=[
      ['#975b39','#aa6841','#bb7043','#a5623c','#c7804e','#96583a'],
      ['#485461','#555f69','#65717a','#57656d','#5d6874','#4b5965'],
      ['#745846','#876448','#947151','#80634f','#a17a5a','#836451'],
    ][i-8]
    rect(ink,0,0,CELL,CELL,colors[0])
    for(let y=-10,row=0;y<CELL+10;y+=9,row++) {
      for(let x=-12+(row%2)*5.5;x<CELL+12;x+=11) {
        const y2=y+random()*.7
        rect(ink,x,y2,10.7,8.6,colors[Math.floor(random()*colors.length)])
        rect(ink,x,y2+7.2,10.6,1.5,'rgba(36,27,26,.52)')
        rect(ink,x+.7,y2+.7,1,6.2,'rgba(255,225,179,.20)')
        if (random()<.27) rect(ink,x+2,y2+4.2,5,.7,'rgba(213,187,150,.23)')
      }
    }
  }
  function stone() {
    rect(ink,0,0,256,256,'#928574')
    const colors=['#ac9983','#a1947a','#a79e88','#948c7d','#b4a98e','#9d9787']
    for(let j=0,y=0;y<256;j++,y+=15) {
      for(let x=-48+random()*24;x<256;) {
        const w=16+random()*26
        rect(ink,x,y,w-1,14,colors[Math.floor(random()*colors.length)])
        rect(ink,x+1,y+1,w-3,1,'rgba(237,219,180,.3)')
        for(let k=0;k<16;k++) rect(ink,x+random()*w,y+random()*13,2,1,'rgba(54,51,47,.15)')
        x+=w
      }
    }
  }
  function gable() {
    plaster(1)
    for (const y of [4,125,247]) timber(0,y,256,y,8)
    for (const x of [34,83,128,173,222]) timber(x,0,x,256,5)
    timber(4,245,129,5,7);timber(252,245,128,5,7)
    window(113,119,30,48,1,true,false)
    window(119,63,18,29,1,false,false)
  }
  function clockFace() {
    stone()
    rect(ink,0,0,256,256,'rgba(237,222,190,.68)')
    ink.fillStyle='#5a5748'
    ink.beginPath();ink.arc(128,113,73,0,Math.PI*2);ink.fill()
    ink.fillStyle='#f0d8a2'
    ink.beginPath();ink.arc(128,113,67,0,Math.PI*2);ink.fill()
    for(let j=0;j<12;j++) {
      const a=j*Math.PI/6
      stroke(ink,128+Math.sin(a)*57,113-Math.cos(a)*57,128+Math.sin(a)*64,113-Math.cos(a)*64,3.2,'#403f39')
    }
    stroke(ink,128,113,163,98,5,'#34342f');stroke(ink,128,113,112,72,3,'#34342f')
    for(let j=0;j<3;j++){
      rect(ink,78+35*j,209,21,47,'#504b3f')
      for(let k=0;k<5;k++) rect(ink,78+35*j,217+7*k,21,2,'#a79473')
    }
  }
  for(let i=0;i<16;i++) {
    const x=(i%4)*CELL,y=Math.floor(i/4)*CELL
    for(const ctx of [ink,glow]){
      ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.rect(0,0,CELL,CELL);ctx.clip()
    }
    if(i<8) facade(i)
    else if(i<11) roof(i)
    else if(i===11) stone()
    else if(i===12) gable()
    else if(i===13) clockFace()
    else if(i===14){
      rect(ink,0,0,256,256,'#7d715d')
      for(let j=0;j<28;j++) rect(ink,0,j*10,256,1,'#594a3d')
      for(let j=0;j<120;j++) stroke(ink,random()*CELL,random()*CELL,random()*CELL,random()*CELL,.5,'rgba(64,47,29,.12)')
    } else rect(ink,0,0,256,256,'#ffffff')
    ink.restore();glow.restore()
  }
  function texture(ctx){
    const tex=new THREE.CanvasTexture(ctx.canvas)
    tex.colorSpace=THREE.SRGBColorSpace
    tex.anisotropy=4
    return tex
  }
  return {map:texture(ink),emissiveMap:texture(glow)}
}

function atlasUV(tile,u,v){
  const margin = 1.6 / CELL
  return [(tile%4+margin+u*(1-margin*2))/4,
    1-(Math.floor(tile/4)+margin+(1-v)*(1-margin*2))/4]
}

export function buildVillage(scene,roadAt,groundAt,shadows){
  const random=randomSequence(316872)
  const group=new THREE.Group()
  group.name='Timber villages'
  scene.add(group)
  const atlas=villageAtlas()
  const material=new THREE.MeshLambertMaterial({...atlas,vertexColors:true,emissive:'#ffce8c',emissiveIntensity:.06,side:THREE.DoubleSide})
  const chunks=new Map()
  let section
  const pick=a=>a[Math.floor(random()*a.length)]
  function chunkFor(s){
    const key=Math.floor(s/100)
    if(!chunks.has(key)) chunks.set(key,{key,p:[],uv:[],c:[],idx:[]})
    section=chunks.get(key)
  }
  function polygon(points,tile,color,coords) {
    const i=section.p.length/3, tint=new THREE.Color(color)
    for(let j=0;j<points.length;j++){
      section.p.push(...points[j]);section.uv.push(...atlasUV(tile,...coords[j]));section.c.push(tint.r,tint.g,tint.b)
    }
    section.idx.push(i,i+1,i+2)
    if(points.length===4)section.idx.push(i,i+2,i+3)
  }
  const quadUV=[[0,0],[1,0],[1,1],[0,1]]
  const triUV=[[0,0],[1,0],[.5,1]]
  function frame(x,y,z,angle){
    const cos=Math.cos(angle), sin=Math.sin(angle)
    const pt=(xx,yy,zz)=>[x+xx*cos+zz*sin,y+yy,z-xx*sin+zz*cos]
    const quad=(a,b,c,d,tile,tint='#ffffff')=>polygon([a,b,c,d].map(p=>pt(...p)),tile,tint,quadUV)
    const tri=(a,b,c,tile,tint='#ffffff')=>polygon([a,b,c].map(p=>pt(...p)),tile,tint,triUV)
    function box(cx,base,cz,w,h,d,tile,color,top=tile){
      const l=cx-w/2,r=cx+w/2,b=cz-d/2,f=cz+d/2,t=base+h
      quad([l,base,f],[r,base,f],[r,t,f],[l,t,f],tile,color)
      quad([r,base,b],[l,base,b],[l,t,b],[r,t,b],tile,color)
      quad([r,base,f],[r,base,b],[r,t,b],[r,t,f],tile,color)
      quad([l,base,b],[l,base,f],[l,t,f],[l,t,b],tile,color)
      quad([l,t,f],[r,t,f],[r,t,b],[l,t,b],top,color)
    }
    return {pt,quad,tri,box}
  }

  function house(x,s,w,d,h,angle,near=false) {
    chunkFor(s)
    const ground=groundAt(x,s)
    const {quad,tri,box}=frame(x,ground,-s,angle)
    if(shadows) {
      shadows.ellipse(x-2.6,s-2.1,w*.82,d*.76,.34,angle)
      shadows.ellipse(x,s,w*.65,d*.64,.4,angle)
    }
    const color=pick(['#ffeedb','#fff8e8','#f5e4c9','#faead5','#fff7eb','#f2e8d7'])
    const face=Math.floor(random()*8), side=(face+3)%8
    const roofTile=pick([8,8,8,8,9,9,10])
    const roofColor=pick(['#fff1d6','#fff8ef','#e4c5a7','#f7e3c3','#f4d4bd'])
    const l=-w/2,r=w/2,f=d/2,b=-d/2, ceiling=h
    box(0,-4,0,w+.14,4.45,d+.14,11,'#d8ccba')
    quad([l,.40,f],[r,.40,f],[r,ceiling,f],[l,ceiling,f],face,color)
    quad([r,.40,b],[l,.40,b],[l,ceiling,b],[r,ceiling,b],face,color)
    quad([r,.40,f],[r,.40,b],[r,ceiling,b],[r,ceiling,f],side,color)
    quad([l,.40,b],[l,.40,f],[l,ceiling,f],[l,ceiling,b],side,color)
    const top=h+w*(.49+random()*.22)
    const overhang=.45+random()*.43
    const left=l-overhang,right=r+overhang,front=f+.45,back=b-.45
    const hip=random()<.22
    const ends=hip?Math.min(2,d*.23):0
    quad([left,h-.17,front],[left,h-.17,back],[0,top,back+ends],[0,top,front-ends],roofTile,roofColor)
    quad([right,h-.17,back],[right,h-.17,front],[0,top,front-ends],[0,top,back+ends],roofTile,roofColor)
    if(hip){
      tri([left,h-.17,front],[right,h-.17,front],[0,top,front-ends],roofTile,roofColor)
      tri([right,h-.17,back],[left,h-.17,back],[0,top,back+ends],roofTile,roofColor)
    } else {
      tri([l,h,f],[r,h,f],[0,top-.1,f],12,color)
      tri([r,h,b],[l,h,b],[0,top-.1,b],12,color)
    }
    // Thin fascia boards, chimneys and dormers break the roof silhouette from the ridge above.
    for(const edge of [left,right]) box(edge,h-.26,0,.16,.17,front-back,14,'#a88d72')
    const cx=(random()-.5)*w*.48,cz=(random()-.5)*d*.5, stackTop=top+.35+random()*1.1
    box(cx,h,cz,.64,stackTop-h,.68,11,'#a99a8d')
    box(cx,stackTop-.03,cz,.82,.2,.86,11,'#bfb3a5')
    if(near || random()<.24){
      const flank=random()<.5?-1:1
      const dx=flank*w*.32, dz=d*(random()-.5)*.4, dw=1.32
      const dy=h+(top-h)*.36
      box(dx,dy,dz,dw,1.25,1.24,12,'#efdfc1')
      const t=dy+1.28
      quad([dx-dw*.67,t,dz+.8],[dx-dw*.67,t,dz-.8],[dx,t+.65,dz-.8],[dx,t+.65,dz+.8],roofTile,roofColor)
      quad([dx+dw*.67,t,dz-.8],[dx+dw*.67,t,dz+.8],[dx,t+.65,dz+.8],[dx,t+.65,dz-.8],roofTile,roofColor)
      tri([dx-dw*.5,t,dz+.64],[dx+dw*.5,t,dz+.64],[dx,t+.62,dz+.64],12,color)
    }
    if(near) {
      if(random()<.42) {
        const height=h*.40, width=w*.68
        box(0,height,f+.37,width,.19,.9,14,'#bd9c72')
        box(0,height+.74,f+.77,width,.11,.12,14,'#9f805f')
        for(let i=0;i<9;i++) box((i/8-.5)*width,height+.10,f+.76,.075,.65,.1,14,'#c1a57c')
      } else if(random()<.65){
        const lip=f+1.62, tint=pick(['#a95b44','#c9b883','#a8aaa0','#9a5975','#7b9280'])
        for(let i=0;i<9;i++) {
          const a=w*(i/9-.5)*.72,b=w*((i+1)/9-.5)*.72
          const cloth=i%2===0?tint:'#eee1c6'
          quad([a,2.35,lip],[b,2.35,lip],[b,3.08,f],[a,3.08,f],15,cloth)
          quad([a,2.12,lip],[b,2.12,lip],[b,2.36,lip],[a,2.36,lip],15,cloth)
        }
        for(const dx of [-w*.33,w*.33]) box(dx,.18,lip,.085,2.1,.085,14,'#d2bc8e')
        box(0,.47,f+1.1,w*.64,.40,.72,14,'#bd9261')
        for(let i=0;i<4;i++){
          const dx=(i-1.5)*w*.145
          box(dx,.87,f+1.10,w*.14,.16,.64,14,'#d0ab79')
          box(dx,1.03,f+1.1,w*.118,.075,.53,15,['#ca914c','#ab523d','#8ea33e','#d3a145'][i])
        }
      }
    }
  }

  function church(x,s,size=1) {
    chunkFor(s)
    const ground=groundAt(x,s)
    const {tri,quad,box}=frame(x,ground,-s,.25)
    const w=7*size,d=16*size,h=6.5*size
    box(0,-4,0,w,h+4,d,11,'#f3debb')
    for (const sign of [-1,1]) quad([sign*w*.58,h,d*.55],[sign*w*.58,h,-d*.55],[0,h+w*.7,-d*.55],[0,h+w*.7,d*.55],9,'#a5ad9c')
    const side=w*.72,tZ=d*.30, tower=16*size
    box(0,-3,tZ,side,tower+3,side,11,'#f1dfbd')
    box(0,tower*.63,tZ,side+.32,.3,side+.32,11,'#dfceb2')
    box(0,tower*.65,tZ,side+.06,tower*.35,side+.06,13,'#ffedce')
    box(0,tower-.1,tZ,side+.60,.42,side+.6,11,'#ddccad')
    const t=tower+.35, rad=side*.62
    const eaves=[[-rad,t,tZ+rad],[rad,t,tZ+rad],[rad,t,tZ-rad],[-rad,t,tZ-rad]]
    eaves.forEach((a,i)=>tri(a,eaves[(i+1)%4],[0,t+10.6*size,tZ],9,'#81918b'))
    box(0,t+10.4*size,tZ,.12,1.22,.12,15,'#6d5d41')
    box(0,t+11.2*size,tZ,.66,.12,.12,15,'#6d5d41')
  }

  // Rows follow a set of valley lanes, leaving courtyards and gardens around the church.
  const churches=[[118,-49,1.06],[222,-88,.93],[486,-42,1.2],[831,57,1],[1156,-60,1.14]]
  function pathPoint(s,dx,lift) {
    const x=roadAt(s).x+dx
    return [x,groundAt(x,s)+lift,-s]
  }
  function path(s,t,offsetA,offsetB,width,tone,lift=.085) {
    chunkFor(s)
    polygon([pathPoint(s,offsetA-width,lift),pathPoint(s,offsetA+width,lift),
      pathPoint(t,offsetB+width,lift),pathPoint(t,offsetB-width,lift)],11,tone,quadUV)
  }
  function parish(start,end,side,cols) {
    for(let col=0;col<cols;col++) {
      const laneOffset=s=>side*(29.2+col*13+6*Math.sin(s*.024+col*.55))
      for(let s=start;s<end;s+=4) path(s,s+4,laneOffset(s),laneOffset(s+4),1.08,'#d1bd9b',.22)
      for(let s=start+random()*8;s<end;s+=10.8+random()*6.4){
        if(random()<.15) continue
        const drift=6*Math.sin(s*.024+col*.55)
        const dx=side*(37+col*13+drift+random()*3)
        if(churches.some(([along,lateral])=>Math.abs(along-s)<11 && Math.abs(lateral-dx)<8)) continue
        const x=roadAt(s).x+dx
        house(x,s,4.8+random()*3.4,5+random()*3.3,3.6+random()*3.4,Math.sin(s*.029+col)*.64+(col%4===1?Math.PI*.5:0))
      }
    }
  }
  parish(16,296,-1,8);parish(45,204,1,4)
  parish(335,700,-1,5);parish(685,890,1,4);parish(990,1295,-1,6)
  for(const [s,dx,scale] of churches) {
    church(roadAt(s).x+dx,s,scale)
  }

  function pedestrian(s,side,lateral) {
    chunkFor(s)
    const x=roadAt(s).x+side*lateral, y=groundAt(x,s)
    const {quad}=frame(x,y,-s,random()*Math.PI*2)
    const skin=pick(['#c89976','#cfaa87','#aa7957','#daba92'])
    const coat=pick(['#83534a','#507c81','#c9ad80','#6b7589','#976856','#879579'])
    const hair=pick(['#665143','#483b34','#8d795c'])
    function form(cx,cz,rings,tint) {
      const n=7
      for(let j=1;j<rings.length;j++) {
        const [y0,w0,d0]=rings[j-1], [y1,w1,d1]=rings[j]
        for(let i=0;i<n;i++){
          const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2
          quad([cx+Math.cos(a)*w0,y0,cz+Math.sin(a)*d0],
            [cx+Math.cos(b)*w0,y0,cz+Math.sin(b)*d0],
            [cx+Math.cos(b)*w1,y1,cz+Math.sin(b)*d1],
            [cx+Math.cos(a)*w1,y1,cz+Math.sin(a)*d1],15,tint)
        }
      }
    }
    for(const sign of [-1,1]) {
      form(sign*.11,sign*.047,[[.025,.078,.135],[.37,.075,.082],[.86,.092,.1]],'#565450')
      form(sign*.247,0,[[.84,.046,.053],[.98,.055,.06],[1.31,.077,.088]],coat)
      form(sign*.251,.012,[[.77,.036,.045],[.85,.044,.048]],skin)
    }
    form(0,0,[[.80,.179,.119],[1.15,.205,.125],[1.34,.234,.12],[1.398,.105,.085]],coat)
    form(0,0,[[1.36,.069,.072],[1.43,.072,.076],[1.47,.116,.102],[1.61,.135,.122],[1.69,.092,.092]],skin)
    form(0,0,[[1.594,.134,.124],[1.67,.122,.116],[1.715,.071,.076],[1.726,.01,.016]],hair)
  }
  function lantern(s,side) {
    chunkFor(s)
    const x=roadAt(s).x+side*5.8
    const {box,tri}=frame(x,groundAt(x,s),-s,0)
    box(0,0,0,.24,.25,.24,11,'#a59e8e')
    box(0,.20,0,.098,2.88,.098,15,'#3a423c')
    box(0,3.04,0,.30,.10,.30,15,'#3a423c')
    box(0,3.14,0,.22,.32,.22,15,'#f1d297')
    for(const a of [-.112,.112]) for(const b of [-.112,.112]) box(a,3.14,b,.022,.32,.022,15,'#3a423c')
    const base=[[-.20,3.46,.20],[.20,3.46,.20],[.20,3.46,-.20],[-.20,3.46,-.20]]
    base.forEach((a,i)=>tri(a,base[(i+1)%4],[0,3.69,0],15,'#424941'))
  }
  function flags(s) {
    chunkFor(s)
    const road=roadAt(s), y=road.y+6.2
    const {tri,quad,box}=frame(road.x,y,-s,0)
    const a=-8,b=8,n=15
    for(const side of [-1,1]) box(side*8,-6.7,0,.09,6.85,.09,14,'#8a7761')
    let prev=a
    const sag=x=>-1.15*(1-Math.pow(x/8,2))
    for(let i=1;i<=n;i++) {
      const x=a+(b-a)*i/n
      quad([prev,sag(prev),.03],[x,sag(x),.03],[x,sag(x)+.035,0],[prev,sag(prev)+.035,0],15,'#524b3b')
      tri([prev+.12,sag(prev)-.02,0],[x-.13,sag(x)-.02,.04],[(x+prev)/2,sag(x)-.68,.14],
        15,['#cc573e','#dfbb4b','#458c94','#efe4be','#7a92b8'][i%5])
      prev=x
    }
  }
  for(const [start,end] of [[398,654],[1050,1210]]) {
    for(const side of [-1,1]) {
      for(let s=start;s<end;s+=2) path(s,s+2,side*6,side*6,1.79,'#d6c9ae',.06)
      let s=start+random()*8
      while(s<end) {
        const w=5.8+random()*2.8,d=6+random()*2.8
        const heading=Math.atan((roadAt(s+2).x-roadAt(s-2).x)/4)
        // Keep balconies and awnings behind the shoulder throughout each bend.
        const angle=-side*Math.PI/2-heading+(random()-.5)*.18
        const x=roadAt(s).x+side*(7.7+d*.5+random()*1.7)
        house(x,s,w,d,5+random()*3.3,angle,true)
        s+=w+2.3+random()*3.6
      }
    }
    for(let s=start+16;s<end;s+=58) flags(s)
    for(let s=start+8;s<end;s+=26) {
      const side=random()<.5?-1:1
      lantern(s,side)
      pedestrian(s+3,side,6.9)
      if(random()<.65) pedestrian(s+3.8,side,7.25)
      if(random()<.45) pedestrian(s+12,-side,6.7)
    }
  }

  const sections=[]
  for(const {key,p,uv,c,idx} of chunks.values()){
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3))
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3))
    geometry.setIndex(idx);geometry.computeVertexNormals();geometry.computeBoundingSphere()
    const mesh=new THREE.Mesh(geometry,material)
    mesh.receiveShadow=true
    group.add(mesh)
    sections.push({start:key*100,mesh})
  }
  return {
    update(s){
      for(const {start,mesh} of sections) {
        mesh.visible=s>start-420 && s<start+138
        mesh.castShadow=s>start-75 && s<start+116
      }
    },
    setTheme(theme){material.emissiveIntensity=theme==='dusk'?1.7:.05},
  }
}
