// Boat Candidate 3: Rugged Sea Skiff with Helm Arch
export default function (THREE) {
  const g = new THREE.Group();

  // Materials
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a506b, roughness: 0.7, flatShading: true });
  hullMat.name = 'metal';
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2541, roughness: 0.8, flatShading: true });
  trimMat.name = 'metal';
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xe0fbfc, roughness: 0.5, flatShading: true });
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xf4a261, emissiveIntensity: 2.0, flatShading: true });

  // 1. Double Lathe / Hull Shell
  const points = [];
  points.push(new THREE.Vector2(0, 0));
  points.push(new THREE.Vector2(0.4, 0.1));
  points.push(new THREE.Vector2(0.85, 0.4));
  points.push(new THREE.Vector2(0.75, 0.9));
  points.push(new THREE.Vector2(0.7, 0.85)); // inner rim
  points.push(new THREE.Vector2(0, 0.3));

  const latheGeo = new THREE.LatheGeometry(points, 12, 0, Math.PI * 2);
  const latheMesh = new THREE.Mesh(latheGeo, hullMat);
  latheMesh.scale.set(1.0, 0.75, 2.5); // stretch along Z for boat hull shape
  g.add(latheMesh);

  // 2. Helm Arch (Cabin Frame Silhouette)
  const archOuter = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 10, Math.PI), trimMat);
  archOuter.position.set(0, 0.7, -0.4);
  g.add(archOuter);

  const archLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), trimMat);
  archLeg1.position.set(-0.7, 0.35, -0.4);
  g.add(archLeg1);

  const archLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), trimMat);
  archLeg2.position.set(0.7, 0.35, -0.4);
  g.add(archLeg2);

  // 3. Tall Aft Mast & Fin
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.5, 6), trimMat);
  mast.position.set(0, 1.3, -1.5);
  g.add(mast);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.6), accentMat);
  fin.position.set(0, 0.8, -1.8);
  g.add(fin);

  // 4. Elevated Bow Lantern Post
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), trimMat);
  lanternPost.position.set(0, 0.9, 1.7);
  lanternPost.rotation.x = 0.2;
  g.add(lanternPost);

  const lanternBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), lanternMat);
  lanternBody.position.set(0, 1.4, 1.8);
  g.add(lanternBody);

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
