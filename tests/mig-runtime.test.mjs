import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MIGSession } from '../vendor/motion-input-grid/runtime/session.mjs';

test('the vendored runtime is the published release the site depends on',async()=>{
    const site=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
    const metadata=JSON.parse(await readFile(new URL('../vendor/motion-input-grid/package.json',import.meta.url)));
    // Either an exact npm version or the npm archive attached to the matching GitHub release tag.
    const wanted=site.dependencies['motion-input-grid'];
    const version=wanted.match(/\/releases\/download\/v[\d.]+\/motion-input-grid-([\d.]+)\.tgz$/)?.[1]??wanted;
    assert.equal(metadata.version,version);
    assert.equal(metadata.runtimeSource,undefined,'No upstream source override remains');
});

test('the deployed SDK releases its stream, pose model, tracker and RAF across repeated sessions and late loading',async t=>{
    const counters={tracks:0,models:0,trackers:0,frames:0,captures:0};
    const raf=new Map();let next=0;
    const replace=(name,value)=>{
        const original=Object.getOwnPropertyDescriptor(globalThis,name);
        Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
        t.after(()=>original?Object.defineProperty(globalThis,name,original):delete globalThis[name]);
    };
    replace('fetch',async()=>({ok:true,json:async()=>({schema_version:2,tracking:{hands:false},inputs:[]})}));
    replace('navigator',{mediaDevices:{getUserMedia:async()=>{
        counters.captures++;return{getTracks:()=>[{stop(){counters.tracks++;}}]};
    }}});
    replace('requestAnimationFrame',callback=>{raf.set(++next,callback);return next;});
    replace('cancelAnimationFrame',id=>raf.delete(id));
    const models=()=>({pose:{detectForVideo(){counters.frames++;return{};},close(){counters.models++;}},hands:null});
    const make=(loadModels=async()=>models())=>new MIGSession({profileMode:true,drawOverlay:false,dependencies:{
        createTracker:async()=>({trackHands:()=>false,recalibrate(){},restart(){},update(){},dispose(){counters.trackers++;}}),loadModels
    }});
    for(let i=0;i<5;i++){
        const session=make(),video={readyState:2,currentTime:1,videoWidth:640,videoHeight:480,play:async()=>{}};
        session.subscribe(()=>{});await session.start(video,null);assert.equal(raf.size,1);
        session.dispose();session.dispose();
        assert.equal(video.srcObject,null);assert.equal(raf.size,0);assert.equal(session.listeners.size,0);
    }
    let resolve;
    const late=make(()=>new Promise(done=>{resolve=done;}));
    const starting=late.start({},null);await new Promise(done=>setImmediate(done));
    late.dispose();resolve(models());await starting;
    assert.deepEqual(counters,{tracks:5,models:6,trackers:6,frames:5,captures:5});
});
