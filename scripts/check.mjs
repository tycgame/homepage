import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const html=await readFile('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique');
for(const match of html.matchAll(/(?:href|src)="\.\/([^"]+)"/g))await access(match[1]);
for(const match of html.matchAll(/(?:href)="#([^"]+)"/g))assert.ok(ids.includes(match[1]),`Missing anchor ${match[1]}`);
const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
for(const icon of manifest.icons)await access(icon.src);
for(const file of ['app.js','geometry.js','navigation.js','project-app.js','project-preloader.js','sculpture.js','sculpture-cpu.js','sw.js','scripts/build.mjs']){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))await access(match[1]);
}
assert.ok(html.includes('https://tycofficial.github.io/phigros/'),'Native link must survive unavailable JavaScript');
console.log(`Validated ${ids.length} unique IDs, local assets, anchors, manifest, module syntax and destination.`);
