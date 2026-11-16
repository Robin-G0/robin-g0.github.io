import test from 'node:test';
import assert from 'node:assert/strict';
import {BindingStore, BindingGate, compileBindings, validateBindings} from '../arcade/mig/bindings.js';
import {constructionLiftProfile} from '../arcade/mig/profile.js';
import {MotionCamera} from '../arcade/mig/camera.js';
import {MIGTracker} from '../vendor/motion-input-grid/runtime/mig-tracker.mjs';

const description={engine:'maze',controls:{left:'L',right:'R'}};
const custom=structuredClone(constructionLiftProfile);
custom.inputs[0].id='my-raise';custom.inputs[0].action='my arbitrary action';
custom.inputs[0].name='Raise to choose';
const load=async()=>({MIGTracker});

test('native validation accepts MIG exports and rejects invalid rules',async()=>{
    const profile=await validateBindings(JSON.stringify(custom),load);
    assert.equal(profile.inputs[0].id,'my-raise');
    const bad=structuredClone(custom);bad.inputs[0].steps[0].constraints[0].landmark='not_a_landmark';
    await assert.rejects(validateBindings(JSON.stringify(bad),load));
    await assert.rejects(validateBindings(JSON.stringify({schema_version:1,inputs:[]}),load));
    await assert.rejects(validateBindings(JSON.stringify({...custom,inputs:[custom.inputs[0],custom.inputs[0]]}),load));
});

test('partial and shared mappings compile into native channels without changing source rules',async()=>{
    const before=JSON.stringify(custom);
    const partial=compileBindings(description,constructionLiftProfile,custom,{left:'my-raise'});
    assert.equal(partial.profile.inputs.length,2);
    assert.equal(partial.profile.inputs[1].steps[0].constraints[0].landmark,'right_wrist');
    const shared=compileBindings(description,constructionLiftProfile,custom,{left:'my-raise',right:'my-raise'});
    assert.deepEqual(shared.profile.inputs.map(input=>input.id),['arcade_left','arcade_right']);
    assert.equal(shared.profile.inputs[1].steps[0].constraints[0].landmark,'left_wrist');
    await validateBindings(JSON.stringify(shared.profile),load);
    assert.equal(JSON.stringify(custom),before);
    assert.equal(compileBindings(description,constructionLiftProfile,custom,{}).mapped,false);
});

test('imports are transactional, persist mappings, reset stale assignments and tolerate blocked storage',async()=>{
    let data=null;const storage={getItem:()=>data,setItem:(_,value)=>{data=value;}};
    const store=new BindingStore(storage);
    const file={name:'controls.json',size:100,text:async()=>JSON.stringify(custom)};
    await store.importFile(file,source=>validateBindings(source,load));
    store.setAssignments(description,{left:'my-raise',right:'unknown'});
    assert.deepEqual(new BindingStore(storage).assignments(description),{left:'my-raise',right:''});
    await assert.rejects(store.importFile({...file,text:async()=>'bad'},source=>validateBindings(source,load)));
    assert.equal(store.assignments(description).left,'my-raise');
    await assert.rejects(store.importFile({...file,size:1024*1024+1}));
    await store.importFile(file,source=>validateBindings(source,load));
    assert.deepEqual(store.assignments(description),{left:'',right:''});
    store.clear();assert.equal(new BindingStore(storage).profile,null);
    const blocked=new BindingStore({getItem(){throw Error();},setItem(){throw Error();}});
    await blocked.importFile(file,async()=>custom);assert.equal(blocked.profile,custom);
});

test('ID routing ignores misleading action names and independently deduplicates controls',()=>{
    const gate=new BindingGate({inputs:[{id:'a',action:'left'},{id:'b',action:'right'}]},200);
    assert.deepEqual(gate.consume([{id:'a',action:'wrong',timestamp:100},{id:'b',timestamp:100}]).map(e=>e.action),['left','right']);
    assert.equal(gate.consume([{id:'a',timestamp:100},{id:'a',timestamp:99},{id:'missing',action:'left',timestamp:500}]).length,0);
    assert.equal(gate.consume([{id:'a',timestamp:299}]).length,0);
    assert.equal(gate.consume([{id:'a',timestamp:300}]).length,1);
});

test('real native recognition routes a remapped right wrist to the left control with the other wrist absent',async()=>{
    const plan=compileBindings(description,constructionLiftProfile,custom,{left:custom.inputs[1].id});
    const tracker=await MIGTracker.create(JSON.stringify(plan.profile));
    const gate=new BindingGate(plan.profile),events=[];
    try {
        for(let frame=1;frame<=60;frame++){
            const body=tracker.native.bodyBuffer();body.fill(0);
            const put=(index,x,y)=>body.set([x,y,0,1,0,0,0,1],index*8);
            put(11,.65,.35);put(12,.35,.35);
            put(16,.38,frame<40?.55:.2);
            const count=tracker.native.update(frame*50,frame,1,0,0);
            const native=Array.from({length:count},(_,index)=>({id:tracker.native.eventId(index),
                action:tracker.native.eventAction(index),timestamp:frame*50}));
            events.push(...gate.consume(native));
        }
        // The right wrist drives both the selected left command and its default right command.
        assert.deepEqual(events.map(event=>event.action),['left','right']);
    } finally {tracker.dispose();}
});

test('mapped camera events work without unrelated wrists and failed live updates restore the profile',async()=>{
    let options,session;const received=[];
    class Session {
        constructor(value){options=value;session=this;this.state={running:true};}
        subscribe(){return()=>{};} async start(){} dispose(){}
        async importJSON(source){const p=JSON.parse(source);if(p.bad)throw Error('invalid');this.profile=p;}
    }
    const plan=compileBindings(description,constructionLiftProfile,custom,{left:'my-raise'});
    const camera=new MotionCamera({profile:plan.profile,mapped:true,onInput:(...args)=>received.push(args),
        onTracking(){},onStatus(){},clock:()=>100,loadPackage:async()=>({MIGSession:Session})});
    await camera.start({},{});
    options.onAction({id:'arcade_left',action:'untrusted label'});
    options.onFrame({coordinate:()=>null,tracker:{active:()=>false,handCoordinate:side=>{
        assert.ok([0,1].includes(side),'The public native hand API takes anatomical side indexes');return null;
    }}});
    assert.deepEqual(received,[['left',100,{mapped:true}]]);
    await assert.rejects(camera.configure({bad:true},true));
    assert.deepEqual(session.profile,plan.profile);assert.equal(camera.configuring,false);
    await camera.configure(constructionLiftProfile,false);assert.equal(camera.mapped,false);
    camera.stop();
});
