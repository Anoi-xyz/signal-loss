// Boat Candidate 2: Sleek Low-Poly Cutter
export default function (THREE) {
  const g = new THREE.Group();

  // Materials
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a506b, roughness: 0.6, flatShading: true });
  hullMat.name = 'wood';
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.8, flatShading: true });
  deckMat.name = 'wood';
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.7, flatShading: true });
  trimMat.name = 'metal';
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 1.8, flatShading: true });

  // 1. Extruded Main Hull Body
  const shape = new THREE.Shape();
  // Profile along side (Z-Y plane)
  shape.moveTo(0, 0.6);        // Bow top
  shape.lineTo(0.2, 0.0);       // Bow bottom / keel start
  shape.lineTo(-3.8, 0.1);      // Stern bottom
  shape.lineTo(-4.0, 0.7);      // Stern top transom
  shape.lineTo(-3.6, 0.75);     // Stern deck top
  shape.lineTo(-0.2, 0.65);     // Bow deck top
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: 1.4,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelOffset: 0,
    bevelSegments: 2
  };

  const hullGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.rotation.y = Math.PI / 2;
  hullMesh.position.set(-0.85, 0, 2.0);
  g.add(hullMesh);

  // 2. Cockpit Rim & Deck Cap
  const capGeo = new THREE.BoxGeometry(1.4, 0.1, 3.6);
  const deckCap = new THREE.Mesh(capGeo, deckMat);
  deckCap.position.set(0, 0.65, 0);
  g.add(deckCap);

  // 3. Aft Fins & Mast Anchor
  const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.4, 7);
  const mast = new THREE.Mesh(mastGeo, trimMat);
  mast.position.set(0, 1.3, 0.2);
  mast.rotation.x = -0.08;
  g.add(mast);

  const crossGeo = new THREE.BoxGeometry(0.8, 0.06, 0.06);
  const crossBeam = new THREE.Mesh(crossGeo, trimMat);
  crossBeam.position.set(0, 2.0, 0.2);
  g.add(crossBeam);

  const twinFin1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.5), trimMat);
  twinFin1.position.set(-0.5, 0.7, -1.7);
  twinFin1.rotation.z = -0.2;
  g.add(twinFin1);

  const twinFin2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.5), trimMat);
  twinFin2.position.set(0.5, 0.7, -1.7);
  twinFin2.rotation.z = 0.2;
  g.add(twinFin2);

  // 4. Bowsprit & Lantern Head
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), trimMat);
  bowsprit.rotation.x = Math.PI / 2 - 0.2;
  bowsprit.position.set(0, 0.7, 2.1);
  g.add(bowsprit);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), lanternMat);
  lantern.position.set(0, 0.85, 2.4);
  g.add(lantern);

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
