import { mkdir, copyFile, cp, rm, readdir } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const entry of await readdir('dist'))await rm(`dist/${entry}`,{recursive:true,force:true});
for(const file of ['index.html','style.css','app.js','navigation.js','project-app.js','project-preloader.js','sculpture.js','sculpture-cpu.js','geometry.js','sw.js','manifest.webmanifest'])await copyFile(file,`dist/${file}`);
await cp('assets','dist/assets',{recursive:true});
await copyFile('.nojekyll','dist/.nojekyll');
console.log('Built dependency-free static app in dist/.');
