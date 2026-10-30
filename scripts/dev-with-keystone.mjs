// Local counterpart of Vercel's /api/stats function; no credentials are sent to Angular.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const cache = new URL('node_modules/.cache/stats-dev/', root);
await mkdir(cache, { recursive: true });
const target = new URL('stats.mjs', cache);
await writeFile(target, ts.transpileModule(await readFile(new URL('api/stats.ts', root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const api = await import(target.href);
const server = createServer(async (req,res) => {
  try {
    if(!req.url?.startsWith('/api/stats') || !['GET','POST'].includes(req.method)){res.writeHead(404);res.end();return;}
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2048){res.writeHead(413);res.end();return;}}
    // The Angular proxy preserves the browser Origin; use its fixed local origin for validation.
    const request=new Request(`http://localhost:4200${req.url}`,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined});
    const response=await api[req.method](request);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  } catch {res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({configured:false}));}
});
server.listen(4301,'127.0.0.1',()=>console.log('Local stats gateway ready on 127.0.0.1:4301'));
const child=spawn(process.execPath,['node_modules/@angular/cli/bin/ng.js','serve','--proxy-config','proxy.keystone.json'],{cwd:root,stdio:'inherit'});
child.on('exit',code=>{server.close();process.exitCode=code??0;});
process.on('SIGINT',()=>{child.kill();server.close();});
process.on('SIGTERM',()=>{child.kill();server.close();});
