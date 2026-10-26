'use strict';
const fs=require('fs'),path=require('path');const dir=process.env.MINCETONG_DATA_DIR?path.resolve(process.env.MINCETONG_DATA_DIR):path.resolve(__dirname,'../data');
const db=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8')),rows=db.residents.filter(r=>r.synthetic&&r.datasetBatch===require('../server/pioneer-data.cjs').BATCH).map(({token,...r})=>r);
fs.writeFileSync(path.join(dir,'pioneers-synthetic-3000.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');console.log('Exported '+rows.length+' synthetic profiles without authentication tokens');
