'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../public'),source=fs.readFileSync(path.join(root,'workbench.html'));
if(!fs.existsSync(path.join(root,'index.html'))||!fs.readFileSync(path.join(root,'index.html')).equals(source))fs.writeFileSync(path.join(root,'index.html'),source);
