import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import path from 'node:path';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['.runtime','node_modules'].includes(e.name)?walk(path.join(dir,e.name)):e.isFile()&&/\.(mjs|js)$/.test(e.name)?[path.join(dir,e.name)]:[]);}
const files=walk('.');for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'inherit'});console.log(`语法检查通过：${files.length} 个文件`);
