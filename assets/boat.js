// Signal Loss - Boat Asset (Selected Winner from 404 Recipe)
export default function (THREE) {
  const g = new THREE.Group();

  // Palette: #3a506b hull, #1c2541 mid water/trim, #ffd166 lantern glow, #8d99ae metal
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a506b, roughness: 0.7, flatShading: true });
  hullMat.name = 'timber';
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.8, flatShading: true });
  trimMat.name = 'timber';
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.9, flatShading: true });
  deckMat.name = 'timber';
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, roughness: 0.4, metalness: 0.6, flatShading: true });
  metalMat.name = 'metal';
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa500, emissiveIntensity: 2.0, flatShading: true });

  // 1. Faceted Hull (4m length, 1.5m width, 0.8m height)
  const hullGeo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    // Keel & Bow (bottom points)
    0, 0, 2.0,       // 0: Bow tip bottom
    0, -0.4, 0.0,    // 1: Mid keel
    0, -0.3, -2.0,   // 2: Stern bottom

    // Port gunwale top
    -0.75, 0.5, -2.0, // 3: Stern port top
    -0.85, 0.5, 0.0,  // 4: Mid port top
    -0.1, 0.6, 2.0,   // 5: Bow port top

    // Starboard gunwale top
    0.75, 0.5, -2.0,  // 6: Stern starboard top
    0.85, 0.5, 0.0,   // 7: Mid starboard top
    0.1, 0.6, 2.0,    // 8: Bow starboard top

    // Deck center points
    0, 0.2, -1.9,    // 9: Stern deck
    0, 0.2, 0.0,     // 10: Mid deck
    0, 0.3, 1.8      // 11: Bow deck
  ]);

  const indices = [
    // Bottom port hull
    0, 4, 1,   0, 5, 4,
    1, 4, 3,   1, 3, 2,

    // Bottom starboard hull
    0, 1, 7,   0, 7, 8,
    1, 2, 6,   1, 6, 7,

    // Transom (stern plate)
    2, 3, 6,

    // Inner deck floor
    9, 3, 4,   9, 4, 10,  10, 4, 5,   10, 5, 11,
    9, 7, 6,   9, 10, 7,  10, 8, 7,   10, 11, 8,

    // Outer bow cap
    5, 0, 8
  ];

  hullGeo.setIndex(indices);
  hullGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  hullGeo.computeVertexNormals();

  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  g.add(hullMesh);

  // 2. Gunwale Rails
  const railGeo = new THREE.BoxGeometry(0.1, 0.1, 4.0);
  const leftRail = new THREE.Mesh(railGeo, trimMat);
  leftRail.position.set(-0.75, 0.52, 0);
  leftRail.rotation.y = 0.05;
  g.add(leftRail);

  const rightRail = new THREE.Mesh(railGeo, trimMat);
  rightRail.position.set(0.75, 0.52, 0);
  rightRail.rotation.y = -0.05;
  g.add(rightRail);

  // 3. Mast & Rear Silhouette Fin Anchor
  const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6);
  const mast = new THREE.Mesh(mastGeo, metalMat);
  mast.position.set(0, 1.2, 0.3);
  mast.rotation.x = -0.05; // slight aft tilt
  g.add(mast);

  const finGeo = new THREE.BoxGeometry(0.04, 0.9, 0.6);
  const rearFin = new THREE.Mesh(finGeo, trimMat);
  rearFin.position.set(0, 0.8, -1.8);
  g.add(rearFin);

  // 4. Bow Lantern (Emissive Light)
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), metalMat);
  lanternPost.position.set(0, 0.8, 1.85);
  g.add(lanternPost);

  const lanternHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lanternMat);
  lanternHead.position.set(0, 1.1, 1.85);
  g.add(lanternHead);

  const lanternCage = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 6, 1, true), metalMat);
  lanternCage.position.set(0, 1.1, 1.85);
  g.add(lanternCage);

  // Alignment (Base at Y=0, Centered X/Z, Front facing +Z)
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
