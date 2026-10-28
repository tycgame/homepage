import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnot, knotPoint, perspective, rotationMatrix } from '../geometry.js';
test('trefoil closes without a visible seam and has finite unit normals',()=>{
  const segments=240,sides=32,mesh=createKnot(segments,sides),stride=(sides+1)*3;
  assert.equal(mesh.positions.length,(segments+1)*(sides+1)*3);
  assert.equal(mesh.indices.length,segments*sides*6);
  assert.ok(mesh.indices.every(index=>index<mesh.positions.length/3));assert.ok(mesh.positions.every(Number.isFinite));
  for(let j=0;j<stride;j++)assert.ok(Math.abs(mesh.positions[j]-mesh.positions[segments*stride+j])<.00001);
  for(let i=0;i<mesh.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...mesh.normals.subarray(i,i+3))-1)<.00001);
  assert.ok(knotPoint(0).every((v,i)=>Math.abs(v-knotPoint(2*Math.PI)[i])<1e-10));
});
test('rotation matrix preserves lengths and camera supports portrait through wide screens',()=>{
  const m=rotationMatrix(.7,-.3,1.2);
  for(let col=0;col<3;col++)assert.ok(Math.abs(Math.hypot(m[col*4],m[col*4+1],m[col*4+2])-1)<1e-6);
  for(const aspect of [.4,.7,1,1.7,2.4])assert.ok(perspective(aspect).every(Number.isFinite));
});
