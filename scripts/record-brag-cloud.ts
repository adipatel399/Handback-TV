import { _android as android, chromium } from 'playwright';
import { execFile as cb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const exec=promisify(cb), adb=resolve('.tools/android-sdk/platform-tools/adb');
const state=JSON.parse(await readFile('.tools/azure/state.json','utf8'));
const run=async(...args:string[])=>(await exec(adb,args)).stdout.trim();
const out=resolve('brag-output/capture'); await mkdir(out,{recursive:true});
const device=(await android.devices()).find(d=>d.serial().startsWith('emulator-'))!;
assert.ok(device,'Start the Android TV emulator');
const page=await(await device.webView({pkg:'com.handback.tv.cloud'})).page();
await page.goto(state.url+'/tv/journeys');
if(page.url().includes('/auth/login')){
 await page.evaluate(password=>{(document.querySelector('input[name=password]') as HTMLInputElement).value=password;document.querySelector('form')!.requestSubmit();},state.password);
}
const heading=(s:string)=>page.waitForFunction(text=>document.querySelector('h1')?.textContent?.includes(text),s,{timeout:35000});
await heading('Where shall we go');
const api=async(path:string,body?:unknown)=>page.evaluate(async({path,body})=>{
 const boot=await(await fetch('/api/bootstrap?role=helper')).json();
 const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${boot.adminToken}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new Error(await response.text()); return response.json();
},{path,body});
await api('/api/lab/reset',{});
await api('/api/journeys/plan',{destinationId:'green-park'});
// Capture only public configuration content; login, credentials and sidebar names are excluded.
const browser=await chromium.launch();const helper=await browser.newPage({viewport:{width:1600,height:1080}});
await helper.goto(state.url+'/helper');await helper.locator('[name=password]').fill(state.password);await helper.locator('button[type=submit]').click();
await helper.getByText('Hosted private preview.',{exact:false}).waitFor();
await helper.getByRole('button',{name:'Live journeys',exact:true}).click();
await helper.getByRole('button',{name:'Save journey settings'}).waitFor();
await helper.locator('.helper-main').screenshot({path:out+'/helper-journeys.png'});
await helper.getByRole('button',{name:'Usability sessions',exact:true}).click();
await helper.getByRole('heading',{name:'Does it give independence back?'}).waitFor();
await helper.locator('.helper-main').screenshot({path:out+'/helper-observations.png'});
await browser.close();
const recorder=spawn(adb,['shell','screenrecord','--bit-rate','8000000','--time-limit','112','/sdcard/handback-brag-cloud.mp4'],{stdio:'ignore'});
const done=new Promise<void>((res,rej)=>recorder.on('exit',c=>c===0?res():rej(new Error('screenrecord failed'))));
const started=Date.now(), timeline:any[]=[];
const key=(k:number)=>run('shell','input','keyevent',String(k));
const at=async(seconds:number,label:string,action:()=>Promise<void>)=>{
 const wait=seconds*1000-(Date.now()-started);if(wait>0)await new Promise(r=>setTimeout(r,wait));await action();
 timeline.push({at:Math.round((Date.now()-started)/100)/10,label});console.log(label);
};
try{
 await at(6,'Actual D-pad: choose Green Park',async()=>{await key(23);await heading('Green Park');});
 await at(14,'Actual D-pad: review genuine route',async()=>{await key(23);await heading('Your route to Green Park');});
 await at(22,'Actual D-pad: start individual instructions',async()=>{await key(23);await page.waitForFunction(()=>document.body.textContent?.includes('STEP 1 OF'));});
 const count=await page.evaluate(()=>Number(document.body.textContent?.match(/STEP 1 OF (\d+)/)?.[1]));assert.ok(count>0&&count<12);
 await at(30,'Next instruction',async()=>{if(count>1)await key(23);});
 await at(34,'Actual native Play/Pause: read aloud',async()=>{await key(85);});
 await at(39,'Actual native Play/Pause: stop',async()=>{await key(85);});
 await at(44,'Review remaining instructions',async()=>{for(let n=2;n<count;n++){await key(23);await new Promise(r=>setTimeout(r,500));}});
 await at(50,'Save reviewed route',async()=>{await key(23);await heading('Your route is saved');});
 await at(56,'Open saved routes for a fresh check',async()=>{await key(23);await heading('Your saved routes');});
 await at(66,'Cut to separately labelled fictional booking lab',async()=>{await page.goto(state.url+'/tv');await heading('Hello, Arun');});
 await at(71,'Choose fictional library shuttle',async()=>{await key(23);await heading('Riverside Library');});
 await at(77,'Review exact booking terms',async()=>{await key(20);await key(23);await heading('Does this look right');});
 await at(84,'Disclosed fault: raise fare by 20, old confirmation rejected',async()=>{await api('/api/lab',{fareDelta:20});await key(23);await page.waitForFunction(()=>document.body.textContent?.includes('trip details or review time changed'));});
 await at(95,'Fresh confirmation, independently stored receipt',async()=>{await key(23);await heading('You’re going places');});
 await done;await run('pull','/sdcard/handback-brag-cloud.mp4',out+'/cloud-emulator.mp4');
 await writeFile(out+'/capture-evidence.json',JSON.stringify({capturedAt:new Date().toISOString(),platform:'Installed Android TV API 33 ARM64 emulator',package:'com.handback.tv.cloud',inputs:'Actual native D-pad and Media Play/Pause; explicit section navigation at 66s',source:'Real point-in-time TfL response; fictional booking lab; fare fault deliberately injected at 84s',deviceAudioCaptured:false,fictionalHousehold:'Arun',steps:count,timeline},null,2)+'\n');
 console.log('New cloud emulator take captured. No login footage or credentials recorded.');
}finally{await device.close();}
