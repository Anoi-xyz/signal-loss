// Buoy Candidate 1: Ribbed Cylinder Buoy with Cage Lamp
export default function (THREE) {
  const g = new THREE.Group();

  // Materials
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.6, flatShading: true });
  baseMat.name = 'metal';
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.5, metalness: 0.8, flatShading: true });
  frameMat.name = 'metal';
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf4a261, emissive: 0xf4a261, emissiveIntensity: 2.5, flatShading: true });

  // 1. Float Body (Cylinder base with rounded taper)
  const floatGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8);
  const floatMesh = new THREE.Mesh(floatGeo, baseMat);
  floatMesh.position.set(0, 0.3, 0);
  g.add(floatMesh);

  const ribGeo = new THREE.TorusGeometry(0.42, 0.04, 6, 12);
  const rib = new THREE.Mesh(ribGeo, frameMat);
  rib.rotation.x = Math.PI / 2;
  rib.position.set(0, 0.3, 0);
  g.add(rib);

  // 2. Lamp Post & Skeleton Cage
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), frameMat);
  post.position.set(0, 0.85, 0);
  g.add(post);

  // Lamp Head (Named 'lampHead' in userData for dynamic pulse scaling)
  const lampGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const lampMesh = new THREE.Mesh(lampGeo, lampMat);
  lampMesh.position.set(0, 1.1, 0);
  lampMesh.name = 'lampHead';
  g.add(lampMesh);

  // Cage Struts around Lamp Head
  const cageCount = 4;
  for (let i = 0; i < cageCount; i++) {
    const angle = (i / cageCount) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), frameMat);
    strut.position.set(Math.cos(angle) * 0.22, 1.1, Math.sin(angle) * 0.22);
    g.add(strut);
  }

  const cageCap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.15, 6), frameMat);
  cageCap.position.set(0, 1.35, 0);
  g.add(cageCap);

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
