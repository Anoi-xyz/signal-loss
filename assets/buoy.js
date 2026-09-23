// Signal Loss - Nautical Floating Buoy Asset (404 Recipe)
export default function (THREE) {
  const g = new THREE.Group();

  // Palette: #2b3a4a buoy float base, #1c2541 metal frame, #f4a261 buoy lamp glow
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.7, flatShading: true });
  baseMat.name = 'metal';
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.6, metalness: 0.6, flatShading: true });
  frameMat.name = 'metal';
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf4a261, emissive: 0xf4a261, emissiveIntensity: 2.8, flatShading: true });

  // 1. Wide Float Base (Partially submerged float body)
  const floatGeo = new THREE.CylinderGeometry(0.38, 0.48, 0.55, 8);
  const floatMesh = new THREE.Mesh(floatGeo, baseMat);
  floatMesh.position.set(0, 0.05, 0); // Center float base near water line
  g.add(floatMesh);

  // Waterline Bumper / Mooring Ring
  const ringGeo = new THREE.TorusGeometry(0.48, 0.05, 6, 12);
  const ring = new THREE.Mesh(ringGeo, frameMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.15, 0);
  g.add(ring);

  // Submerged Ballast Counterweight
  const ballast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 8), frameMat);
  ballast.position.set(0, -0.35, 0);
  g.add(ballast);

  // 2. Compact Tripod Lamp Frame
  const legCount = 3;
  for (let i = 0; i < legCount; i++) {
    const angle = (i / legCount) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4), frameMat);
    leg.position.set(Math.cos(angle) * 0.22, 0.55, Math.sin(angle) * 0.22);
    leg.rotation.z = Math.cos(angle) * -0.15;
    leg.rotation.x = Math.sin(angle) * 0.15;
    g.add(leg);
  }

  // 3. Emissive Lamp Head
  const lampGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const lampMesh = new THREE.Mesh(lampGeo, lampMat);
  lampMesh.position.set(0, 0.75, 0);
  lampMesh.name = 'lampHead';
  g.add(lampMesh);

  // Expose lamp mesh reference for game loop pulse updates
  g.userData.lampMesh = lampMesh;

  // Radar Reflector Fin Cap on Top
  const finGeo = new THREE.BoxGeometry(0.02, 0.2, 0.2);
  const fin1 = new THREE.Mesh(finGeo, frameMat);
  fin1.position.set(0, 0.95, 0);
  g.add(fin1);

  const fin2 = new THREE.Mesh(finGeo, frameMat);
  fin2.position.set(0, 0.95, 0);
  fin2.rotation.y = Math.PI / 2;
  g.add(fin2);

  // Align origin so water line (y=0) cuts through the middle of float base
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  // Set lower float base submerged: min.y sits at -0.35m
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= (box.min.y + 0.35); o.position.z -= c.z; });

  return g;
}
