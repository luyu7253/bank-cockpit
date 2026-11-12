// 3D 中国地图（three.js）：立体省份 + 发光边界 + 总行光柱 + 分行光柱 + 飞线 + 辉光。
// 只用 vendor/ 里的本地 three.js，不依赖外网。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mercator } from './layout.js';

const K = 60;            // 投影缩放：中国大致铺满 ±40 个单位
const DEPTH = 1.6;       // 省份厚度
const proj = (lon, lat) => mercator(lon, lat, 104, 36, K);

const COLORS = {
  top: 0x0c2a4c, topHover: 0x1f5d9c, side: 0x0a4a7a, edge: 0x4fc3ff, outline: 0x9be7ff,
  hq: 0x4fc3ff, branch: 0x37e0c8, fly: 0x4fc3ff, big: 0xf2b544,
};

/** 光柱：底部亮、顶部透明的竖直圆柱。 */
function pillar(height, radius, color) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 24, 1, true);
  geo.translate(0, height / 2, 0);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uH: { value: height } },
    vertexShader: 'varying float vZ; void main(){ vZ = position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uH; varying float vZ; void main(){ float a = pow(1.0 - clamp(vZ / uH, 0.0, 1.0), 1.6); gl_FragColor = vec4(uColor * 1.6, a * 0.95); }',
  });
  return new THREE.Mesh(geo, mat);
}

/** 扩散光环（循环放大并淡出）。 */
function rippleRing(color, maxScale = 4) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), mat);
  ring.userData = { maxScale };
  return ring;
}

/** 飞线上的彗星：一串点，越靠后越淡。 */
function comet(curve, color, size) {
  const N = 28;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const alpha = new Float32Array(N).map((_, i) => 1 - i / N);
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size } },
    vertexShader: 'attribute float alpha; varying float vA; uniform float uSize; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * (0.35 + alpha) * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor * 1.8, vA * (1.0 - d * 2.0)); }',
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { curve, N, t: 0 };
  return pts;
}

/**
 * 创建地图。返回 { pulse(city, amount), dispose() }。
 * opts: { geo, hq: {name, lon, lat}, branches: [{name, loans}], coords: {城市: [lon, lat]}, onHover(info|null, x, y) }
 */
export function createChinaMap(host, { geo, hq, branches, coords, onHover }) {
  const W = host.clientWidth, H = host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02060f, 0.006);
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 2000);
  const target = new THREE.Vector3(5, -7, 0);

  scene.add(new THREE.AmbientLight(0x6fa8ff, 1.2));
  const sun = new THREE.DirectionalLight(0xbfe6ff, 2.2);
  sun.position.set(-30, -40, 80);
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  // ---- 底盘：网格 + 旋转扫描环 ----
  const grid = new THREE.GridHelper(220, 44, 0x1a3a5c, 0x0f2238);
  grid.rotation.x = Math.PI / 2; grid.position.z = -0.6;
  grid.material.transparent = true; grid.material.opacity = 0.35;
  world.add(grid);
  const scanMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float sweep = mod(a - uTime * 0.8, 6.2831853) / 6.2831853;
        float beam = pow(1.0 - sweep, 6.0) * smoothstep(1.0, 0.2, r);
        float rings = smoothstep(0.015, 0.0, abs(fract(r * 6.0) - 0.5) - 0.48) * 0.25 * (1.0 - r);
        gl_FragColor = vec4(0.12, 0.45, 0.75, (beam * 0.10 + rings * 0.35) * step(r, 1.0)); }`,
  });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), scanMat);
  scan.position.z = -0.5;
  world.add(scan);

  // ---- 省份 ----
  const provinces = [];
  const topMat = () => new THREE.MeshStandardMaterial({ color: COLORS.top, metalness: 0.2, roughness: 0.6, emissive: 0x06182e, emissiveIntensity: 0.6 });
  const sideMat = new THREE.MeshStandardMaterial({ color: COLORS.side, metalness: 0.3, roughness: 0.4, emissive: 0x0a3a66, emissiveIntensity: 0.9 });
  const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.85 });
  const outlineMat = new THREE.LineBasicMaterial({ color: COLORS.outline });

  for (const f of geo.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const isDashes = String(f.properties.adcode).endsWith('_JD'); // 南海九段线
    const group = new THREE.Group();
    group.userData = { name: f.properties.name || '南海诸岛' };
    const top = topMat();
    for (const rings of polys) {
      const shape = new THREE.Shape(rings[0].map(([lon, lat]) => new THREE.Vector2(...proj(lon, lat))));
      for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(hole.map(([lon, lat]) => new THREE.Vector2(...proj(lon, lat)))));
      const depth = isDashes ? 0.4 : DEPTH;
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), isDashes ? [outlineMat, outlineMat] : [top, sideMat]);
      group.add(mesh);
      if (!isDashes) {
        const pts = rings[0].map(([lon, lat]) => new THREE.Vector3(...proj(lon, lat), DEPTH + 0.02));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
      }
    }
    group.userData.top = top;
    world.add(group);
    if (!isDashes) provinces.push(group);
  }

  // ---- 总行 ----
  const hqPos = new THREE.Vector3(...proj(hq.lon, hq.lat), DEPTH);
  const hqGroup = new THREE.Group();
  hqGroup.position.copy(hqPos);
  hqGroup.add(pillar(16, 0.55, COLORS.hq));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshBasicMaterial({ color: 0xbff0ff }));
  core.position.z = 0.4;
  hqGroup.add(core);
  const hqRings = [0, 1, 2].map((i) => {
    const r = rippleRing(COLORS.hq, 6);
    r.position.z = 0.05; r.userData.phase = i / 3;
    hqGroup.add(r);
    return r;
  });
  world.add(hqGroup);

  // ---- 分行 + 飞线 ----
  const lo = Math.min(...branches.map((b) => b.loans)), hi = Math.max(...branches.map((b) => b.loans));
  const routes = new Map();
  const labels = [{ text: hq.name, pos: hqPos.clone().setZ(DEPTH + 17), hq: true }];
  const lineMat = new THREE.LineBasicMaterial({ color: COLORS.fly, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  for (const b of branches) {
    const city = b.name.replace('分行', '');
    if (city === '上海' || !coords[city]) continue;
    const p = new THREE.Vector3(...proj(...coords[city]), DEPTH);
    const h = 3 + ((b.loans - lo) / (hi - lo || 1)) * 7;
    const pg = new THREE.Group();
    pg.position.copy(p);
    pg.add(pillar(h, 0.32, COLORS.branch));
    const ring = rippleRing(COLORS.branch, 3);
    ring.position.z = 0.05; ring.userData.phase = Math.random();
    pg.add(ring);
    world.add(pg);
    const mid = p.clone().lerp(hqPos, 0.5);
    mid.z += 6 + p.distanceTo(hqPos) * 0.28;
    const curve = new THREE.QuadraticBezierCurve3(p, mid, hqPos);
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), lineMat));
    routes.set(city, { curve, ring });
    labels.push({ text: city, sub: `${b.loans} 亿`, pos: p.clone().setZ(DEPTH + h + 1) });
  }

  // ---- HTML 标签（每帧把 3D 坐标投影到屏幕） ----
  const labelLayer = document.createElement('div');
  labelLayer.className = 'map-labels';
  host.append(labelLayer);
  for (const l of labels) {
    l.el = document.createElement('div');
    l.el.className = l.hq ? 'map-label hq' : 'map-label';
    l.el.innerHTML = l.hq ? `<b>${l.text}</b>` : `<b>${l.text}</b><small>${l.sub}</small>`;
    labelLayer.append(l.el);
  }

  // ---- 后处理：辉光 ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.75, 0.45, 0.32));
  composer.addPass(new OutputPass());

  // ---- 悬停省份 ----
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null;
  renderer.domElement.addEventListener('pointermove', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(provinces, true)[0];
    const g = hit ? provinces.find((p) => p === hit.object.parent) : null;
    if (g !== hovered) {
      if (hovered) { hovered.userData.top.color.setHex(COLORS.top); hovered.position.z = 0; }
      hovered = g;
      if (g) { g.userData.top.color.setHex(COLORS.topHover); g.position.z = 0.8; }
    }
    onHover?.(g ? g.userData.name : null, e.clientX, e.clientY);
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    if (hovered) { hovered.userData.top.color.setHex(COLORS.top); hovered.position.z = 0; hovered = null; }
    onHover?.(null);
  });

  // ---- 交易：彗星沿飞线飞向总行 ----
  const comets = [];
  function pulse(city, amount) {
    const route = routes.get(city);
    if (!route) return;
    const big = amount >= 10_000_000;
    const c = comet(route.curve, big ? COLORS.big : COLORS.fly, big ? 2.6 : 1.6);
    c.userData.speed = big ? 0.55 : 0.8;
    c.userData.big = big;
    world.add(c);
    comets.push(c);
    route.ring.userData.phase = 0;
  }

  // ---- 动画 ----
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let raf = 0;
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    // 镜头缓慢摆动
    const az = Math.sin(t * 0.12) * 0.18;
    camera.position.set(target.x + Math.sin(az) * 50, target.y - Math.cos(az) * 50, 66);
    camera.up.set(0, 0, 1);
    camera.lookAt(target);
    scanMat.uniforms.uTime.value = t;
    for (const r of [...hqRings, ...[...routes.values()].map((x) => x.ring)]) {
      r.userData.phase = (r.userData.phase + dt * 0.45) % 1;
      const s = 1 + r.userData.phase * r.userData.maxScale;
      r.scale.set(s, s, 1);
      r.material.opacity = 0.9 * (1 - r.userData.phase);
    }
    core.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i], u = c.userData;
      u.t += dt * u.speed;
      const pos = c.geometry.attributes.position;
      for (let k = 0; k < u.N; k++) {
        u.curve.getPoint(Math.min(1, Math.max(0, u.t - k * 0.012)), tmp);
        pos.setXYZ(k, tmp.x, tmp.y, tmp.z);
      }
      pos.needsUpdate = true;
      if (u.t - u.N * 0.012 > 1) {
        world.remove(c); c.geometry.dispose(); c.material.dispose(); comets.splice(i, 1);
        if (u.big) hqRings[0].userData.phase = 0;
      }
    }
    composer.render();
    // 标签
    const r = renderer.domElement.getBoundingClientRect(), sx = W / r.width;
    for (const l of labels) {
      tmp.copy(l.pos).project(camera);
      l.el.style.transform = `translate(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp.y) / 2) * H}px) translate(-50%, -100%)`;
      void sx;
    }
    raf = requestAnimationFrame(frame);
  }
  frame();

  return {
    pulse,
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); host.replaceChildren(); },
  };
}
