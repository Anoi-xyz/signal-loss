// Buoy Candidate 3: Mooring Ring Buoy with Lantern Tower
export default function (THREE) {
  const g = new THREE.Group();

  // Materials
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a506b, roughness: 0.6, flatShading: true });
  baseMat.name = 'wood';
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.7, flatShading: true });
  frameMat.name = 'metal';
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf4a261, emissive: 0xffa500, emissiveIntensity: 2.2, flatShading: true });

  // 1. Dual Torus Mooring Body
  const torus1 = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 6, 12), baseMat);
  torus1.rotation.x = Math.PI / 2;
  torus1.position.set(0, 0.2, 0);
  g.add(torus1);

  const torus2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 12), baseMat);
  torus2.rotation.x = Math.PI / 2;
  torus2.position.set(0, 0.45, 0);
  g.add(torus2);

  // 2. Center Post
  const centerPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), frameMat);
  centerPillar.position.set(0, 0.5, 0);
  g.add(centerPillar);

  // 3. Lantern Beacon Lamp Head
  const lampHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), lampMat);
  lampHead.position.set(0, 1.05, 0);
  lampHead.name = 'lampHead';
  g.add(lampHead);

  // Top Light Guard Ring
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 4, 8), frameMat);
  guard.rotation.x = Math.PI / 2;
  guard.position.set(0, 1.25, 0);
  g.add(guard);

  // Alignment
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
