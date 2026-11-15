import test from 'node:test';
import assert from 'node:assert/strict';
import createMIG from '../vendor/motion-input-grid/runtime/mig.mjs';
import { arcadeProfile, popupProfile } from '../arcade/mig/profile.js';
import { GestureGate } from '../arcade/mig/gesture-gate.js';
import { visiblePoint } from '../arcade/mig/camera.js';
const wasm = await createMIG();
const home = {left:[6.5,5.5], right:[2.5,5.5]};
const targets = {left_up:[6.5,2], left_left:[10,5.5], left_right:[2.5,5.5],
    right_up:[2.5,2], right_left:[6.5,5.5], right_right:[-1,5.5]};
function harness({aspect=1,width=.3,shoulderY=.3,profile=arcadeProfile}={}) {
    const tracker = new wasm.Tracker(), gate = new GestureGate(), events = [];
    assert.equal(tracker.load(JSON.stringify(profile)), '');
    assert.equal(tracker.trackHands(), false);
    let time = 0, seq = 0;
    const frame = (left=home.left, right=home.right, gap=40) => {
        time += gap; const body = tracker.bodyBuffer(); body.fill(0);
        const put = (index,x,y) => body.set([x,y,0,1,0,0,0,1],index*8);
        put(11,.5+width/2,shoulderY); put(12,.5-width/2,shoulderY);
        for (const [index,point] of [[15,left],[16,right]]) if(point) put(index,.5+(point[0]-4.5)*width*.2,shoulderY+(point[1]-3.5)*width*aspect*.2);
        const count = tracker.update(time,++seq,aspect,0,0), native=[];
        assert.ok(count>=0);
        for(let i=0;i<count;i++) native.push({action:tracker.eventAction(i),timestamp:time});
        events.push(...gate.consume(native,{left:!!left,right:!!right}).map(e=>e.action));
    };
    const dwell=(left,right,gap=40,n=8)=>{for(let i=0;i<n;i++)frame(left,right,gap);};
    dwell(home.left,home.right,40,35);
    return {tracker,gate,events,frame,dwell,close:()=>tracker.delete()};
}
test('packaged WASM distinguishes all six anatomical-wrist and mirrored-screen commands',()=>{
    for(const gap of [33,100,160]) {
        const h=harness();
        try {
            for(const [action,target] of Object.entries(targets)) {
                h.dwell(home.left,home.right,gap);
                h.dwell(action.startsWith('left')?target:home.left,action.startsWith('right')?target:home.right,gap);
                assert.equal(h.events.at(-1),action);
                const count=h.events.length;
                h.dwell(action.startsWith('left')?target:home.left,action.startsWith('right')?target:home.right,gap,25);
                assert.equal(h.events.length,count,'Holding a destination never repeats');
            }
            assert.deepEqual(h.events,Object.keys(targets));
        } finally {h.close();}
    }
});
test('direct target changes need no home visit, held poses do not repeat and reacquisition stays usable',()=>{
    const h=harness();
    try {
        h.dwell(targets.left_up,home.right);
        h.dwell(targets.left_left,home.right);
        h.dwell(targets.left_right,home.right);
        assert.deepEqual(h.events,['left_up','left_left','left_right']);
        h.dwell(null,home.right);h.dwell(targets.left_right,home.right);
        assert.equal(h.events.length,4,'A reacquired wrist can settle and act without a home gate');
        h.dwell(targets.left_right,home.right,40,25);assert.equal(h.events.length,4,'Reacquisition is one pulse, not a held repeat');
        h.dwell(targets.left_left,home.right);h.dwell(targets.left_right,home.right);
        assert.deepEqual(h.events,['left_up','left_left','left_right','left_right','left_left','left_right']);
    }finally{h.close();}
});
test('small reaches work for both wrists in portrait, landscape and close torso crops',()=>{
    const nearby={left_up:[6.5,3.25],left_left:[7.25,5],left_right:[5.75,5],
        right_up:[2.5,3.25],right_left:[3.25,5],right_right:[1.75,5]};
    for(const aspect of [.75,4/3,16/9])for(const width of [.24,.5,.8]){
        const h=harness({aspect,width});
        try{
            for(const [action,target]of Object.entries(nearby)){
                h.dwell(action.startsWith('left')?target:home.left,action.startsWith('right')?target:home.right);
                assert.equal(h.events.at(-1),action);
                const index=arcadeProfile.inputs.findIndex(i=>i.action===action);
                assert.equal(h.tracker.active(index),true,'Native occupancy can highlight the box');
                const point=h.tracker.coordinate(action.startsWith('left')?15:16,0);
                assert.equal(visiblePoint(point),true,'The short reach stays inside the camera crop');
            }
            assert.deepEqual(h.events,Object.keys(nearby));
        }finally{h.close();}
    }
});
test('one wrist suffices and short boundary noise does not become a command',()=>{
    const h=harness();
    try{
        for(let i=0;i<24;i++)h.frame([i%2?7.1:6.9,5.5],null);
        assert.deepEqual(h.events,[],'40 ms excursions do not satisfy native dwell');
        h.dwell(home.left,null);h.dwell(targets.left_up,null);
        assert.deepEqual(h.events,['left_up']);
        assert.equal(h.tracker.coordinate(16,0),null);
        h.frame(null,null);assert.equal(visiblePoint(h.tracker.coordinate(15,0)),false);
    }finally{h.close();}
});
test('event delivery rejects ambiguous batches and duplicates without latching either wrist',()=>{
    const gate=new GestureGate(),visible={left:true,right:true};
    const send=(actions,time)=>gate.consume(actions.map(action=>({action,timestamp:time})),visible);
    assert.equal(send(['right_up'],100).length,1);
    assert.deepEqual(send(['right_up'],100),[]);
    assert.equal(send(['right_up'],400).length,1);
    assert.deepEqual(send(['left_up','left_right'],500),[]);
    assert.equal(send(['left_left','left_left'],600).length,1);
    assert.equal(send(['left_right','right_left'],800).length,2);
});

test('direction regions retain input beyond the old far edges and near visible image borders',()=>{
    const h=harness({aspect:4/3,width:.2});
    const far={left_left:[16.8,6],left_right:[-7.8,6],right_left:[16.8,6],right_right:[-7.8,6],left_up:[-7.8,1],right_up:[16.8,1]};
    try{
        for(const[action,target]of Object.entries(far)){
            h.dwell(action.startsWith('left')?target:home.left,action.startsWith('right')?target:home.right);
            assert.equal(h.events.at(-1),action);
            const point=h.tracker.coordinate(action.startsWith('left')?15:16,0);
            assert.equal(visiblePoint(point),true,'The tested far target remains visible');
            const count=h.events.length;
            if(!action.endsWith('_up')){
                const farther=[target[0]>4.5?16.9:-7.9,13.5];
                h.dwell(action.startsWith('left')?farther:home.left,action.startsWith('right')?farther:home.right);
                assert.equal(h.events.length,count,'Moving farther within the same area does not retrigger');
            }
        }
        assert.deepEqual(h.events,Object.keys(far));
    }finally{h.close();}
});

test('popup side sweeps above shoulder height do not fire Up, for either wrist',()=>{
    for(const wrist of ['left','right'])for(const gap of [50,100]){
        const h=harness({profile:popupProfile,aspect:4/3,width:.2});
        const move=point=>h.dwell(wrist==='left'?point:null,wrist==='right'?point:null,gap);
        try{
            // Start centrally below Up, then sweep through the old Up band.
            move([wrist==='left'?6.5:2.5,2.5]);
            assert.deepEqual(h.events,[],'A shoulder-height preparation is neutral');
            move([10,2.5]);move([-1,2.5]);
            assert.deepEqual(h.events,[`${wrist}_left`,`${wrist}_right`]);
            move([wrist==='left'?6.5:2.5,.5]);
            assert.equal(h.events.at(-1),`${wrist}_up`,'Deliberate higher raises still work');
            const count=h.events.length;
            move([10,.5]);assert.equal(h.events.length,count,'Holding Up never repeats');
            move([16.8,2.5]);move([-7.8,2.5]);
            assert.deepEqual(h.events.slice(-2),[`${wrist}_left`,`${wrist}_right`]);
        }finally{h.close();}
    }
});

test('popup direction boundaries have a neutral band and retain continuous native dwell',()=>{
    const h=harness({profile:popupProfile});
    try{
        for(let i=0;i<24;i++)h.frame([10,i%2?.9:1.5],null);
        assert.deepEqual(h.events,[],'Brief visits to Up cannot accumulate dwell across the gap');
        h.dwell([10,1.5],null);assert.deepEqual(h.events,[],'The vertical gap is neutral');
        h.dwell([10,2.1],null);assert.deepEqual(h.events,['left_left']);
        h.dwell([10,.5],null);assert.deepEqual(h.events,['left_left','left_up']);
    }finally{h.close();}
});
