import test from 'node:test';
import assert from 'node:assert/strict';
import createMIG from '../vendor/motion-input-grid/runtime/mig.mjs';
import { arcadeProfile } from '../arcade/mig/profile.js';
import { GestureGate } from '../arcade/mig/gesture-gate.js';
import { visiblePoint } from '../arcade/mig/camera.js';
const wasm = await createMIG();
const home = {left:[6.5,5.5], right:[2.5,5.5]};
const targets = {left_up:[6.5,2], left_left:[10,5.5], left_right:[2.5,5.5],
    right_up:[2.5,2], right_left:[6.5,5.5], right_right:[-1,5.5]};
function harness() {
    const tracker = new wasm.Tracker(), gate = new GestureGate(), events = [];
    assert.equal(tracker.load(JSON.stringify(arcadeProfile)), '');
    assert.equal(tracker.trackHands(), false);
    let time = 0, seq = 0;
    const frame = (left=home.left, right=home.right, gap=40) => {
        time += gap; const body = tracker.bodyBuffer(); body.fill(0);
        const put = (index,x,y) => body.set([x,y,0,1,0,0,0,1],index*8);
        put(11,.65,.45); put(12,.35,.45);
        for (const [index,point] of [[15,left],[16,right]]) if(point) put(index,.5+(point[0]-4.5)*.06,.45+(point[1]-3.5)*.06);
        const count = tracker.update(time,++seq,1,0,0), native=[];
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
test('native neutral confirmation prevents direct transitions and reappearance from clearing',()=>{
    const h=harness();
    try {
        h.dwell(targets.left_up,home.right);
        h.dwell(targets.left_left,home.right);
        assert.deepEqual(h.events,['left_up']);
        h.dwell(home.left,home.right); h.dwell(targets.left_left,home.right);
        assert.deepEqual(h.events,['left_up','left_left']);
        h.dwell(null,home.right); h.dwell(targets.left_up,home.right);
        assert.equal(h.events.length,2);
        h.dwell(home.left,home.right); h.dwell(targets.left_up,home.right);
        assert.deepEqual(h.events,['left_up','left_left','left_up']);
    }finally{h.close();}
});
test('one visible wrist and shoulders suffice; neutral jitter and diagonal deadbands do nothing',()=>{
    const h=harness();
    try {
        for(let i=0;i<20;i++)h.frame([6.5+(i%2)*.2,5.5],null);
        h.dwell([8.5,3.5],null); assert.deepEqual(h.events,[]);
        h.dwell(home.left,null); h.dwell(targets.left_up,null);
        assert.deepEqual(h.events,['left_up']);
        assert.equal(h.tracker.coordinate(16,0),null);
        assert.equal(visiblePoint(h.tracker.coordinate(15,0)),true);
        h.frame(null,null); assert.equal(visiblePoint(h.tracker.coordinate(15,0)),false);
    }finally{h.close();}
});
test('event gate drops ambiguous callbacks and never transfers readiness to the other wrist',()=>{
    const gate=new GestureGate(), visible={left:true,right:true};
    const send=(...actions)=>gate.consume(actions.map(action=>({action})),visible);
    send('left_neutral'); assert.deepEqual(send('right_up'),[]);
    assert.deepEqual(send('left_up','left_right'),[]);
    assert.deepEqual(send('left_left'),[]);
    send('left_neutral'); assert.equal(send('left_up','left_up').length,1);
});
