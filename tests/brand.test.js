import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {brandAngles,clamp} from '../brand.js';
test('drag angles remain bounded under long swipes and reversed orientation',()=>{
  for(const [x,y] of [[0,0],[9000,9000],[-9000,-9000],[844,390],[390,844]]){const a=brandAngles(x,y);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.ok(Math.abs(a.x)<=13&&Math.abs(a.y)<=19);}assert.equal(clamp(99,-2,2),2);
});
test('home graphics do not reallocate canvas buffers or observe their own size',async()=>{
  const [html,script]=await Promise.all([readFile('index.html','utf8'),readFile('brand.js','utf8')]);assert.ok(!html.includes('<canvas'));assert.ok(!script.includes('ResizeObserver'));assert.ok(!script.includes('createImageData'));assert.ok(html.includes('id="tyc-solid"'));assert.ok(!html.includes('project-open-original'));
});
