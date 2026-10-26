'use strict';
const fs=require('fs'),path=require('path'),{loadCatalog}=require('../server/policy-discovery.cjs');
const dir=process.env.MINCETONG_DATA_DIR?path.resolve(process.env.MINCETONG_DATA_DIR):path.resolve(__dirname,'../data');fs.mkdirSync(dir,{recursive:true});const docs=loadCatalog(),file=path.join(dir,'national-policies.jsonl');fs.writeFileSync(file,docs.map(d=>JSON.stringify(d)).join('\n')+'\n');console.log('Exported '+docs.length+' verified official policy snapshots to '+file);
