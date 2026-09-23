// Buoy Candidate 2: Conical Tripod Float Buoy
export default function (THREE) {
  const g = new THREE.Group();

  // Materials
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.7, flatShading: true });
  baseMat.name = 'metal';
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.5, flatShading: true });
  frameMat.name = 'metal';
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf4a261, emissive: 0xffa500, emissiveIntensity: 2.8, flatShading: true });

  // 1. Tapered Cone Float Base
  const floatGeo = new THREE.ConeGeometry(0.45, 0.7, 7);
  const floatMesh = new THREE.Mesh(floatGeo, baseMat);
  floatMesh.rotation.x = Math.PI; // upside down cone
  floatMesh.position.set(0, 0.35, 0);
  g.add(floatMesh);

  // Ballast Weight Ring
  const ballast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), frameMat);
  ballast.position.set(0, 0.08, 0);
  g.add(ballast);

  // 2. Tripod Frame Legs
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 4), frameMat);
    leg.position.set(Math.cos(angle) * 0.2, 0.95, Math.sin(angle) * 0.2);
    leg.rotation.z = Math.cos(angle) * -0.2;
    leg.rotation.x = Math.sin(angle) * 0.2;
    g.add(leg);
  }

  // 3. Faceted Octahedron Lamp Head
  const lampHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), lampMat);
  lampHead.position.set(0, 1.15, 0);
  lampHead.name = 'lampHead';
  g.add(lampHead);

  // Cross Radar Reflector Fin on Top
  const finGeo = new THREE.BoxGeometry(0.02, 0.25, 0.25);
  const fin1 = new THREE.Mesh(finGeo, frameMat);
  fin1.position.set(0, 1.35, 0);
  g.add(fin1);

  const fin2 = new THREE.Mesh(finGeo, frameMat);
  fin2.position.set(0, 1.35, 0);
  fin2.rotation.y = Math.PI / 2;
  g.add(fin2);

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
