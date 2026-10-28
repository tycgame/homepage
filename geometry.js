// A real trefoil surface, with an orthonormal local frame at every sample.
const TAU = Math.PI * 2;
export function knotPoint(t) {
  const r = 1.58 + .55 * Math.cos(3 * t);
  return [r * Math.cos(2 * t), r * Math.sin(2 * t), .72 * Math.sin(3 * t)];
}
function normalize(v) { const d = Math.hypot(...v); return v.map(x => x / d); }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
export function createKnot(segments = 240, sides = 32) {
  const vertices = [], normals = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments * TAU, c = knotPoint(t), a = knotPoint(t - .0001), b = knotPoint(t + .0001);
    const tangent = normalize(b.map((v, k) => v - a[k]));
    const n = normalize(cross(tangent, [0, 0, 1])), binormal = normalize(cross(tangent, n));
    for (let j = 0; j <= sides; j++) {
      const u = j / sides * TAU;
      const normal = n.map((v, k) => Math.cos(u) * v + Math.sin(u) * binormal[k]);
      vertices.push(...c.map((v, k) => v + .405 * normal[k])); normals.push(...normal);
      if (i < segments && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
      }
    }
  }
  return { positions: new Float32Array(vertices), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}
export function perspective(aspect, near = .1, far = 50) {
  const f = 1 / Math.tan(.61 / 2), range = 1 / (near - far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(near+far)*range,-1,0,0,2*near*far*range,0]);
}
export function rotationMatrix(x, y, z) {
  const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  return new Float32Array([cy*cz,cy*sz,-sy,0,sx*sy*cz-cx*sz,sx*sy*sz+cx*cz,sx*cy,0,cx*sy*cz+sx*sz,cx*sy*sz-sx*cz,cx*cy,0,0,0,0,1]);
}
