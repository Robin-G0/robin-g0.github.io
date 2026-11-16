import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkerMotion } from '../arcade/mig/marker-motion.js';

test('display smoothing reduces visible observation noise without mutating recognition points',()=>{
    const marker=new MarkerMotion();marker.observe({x:.5,y:.5});marker.step(0);
    const displayed=[];
    for(let i=1;i<=60;i++){
        const observation={x:.5+(i%2?.02:-.02),y:.5};
        marker.observe(observation);displayed.push(marker.step(i*33).x);
        assert.deepEqual(observation,{x:.5+(i%2?.02:-.02),y:.5});
    }
    const rms=Math.sqrt(displayed.reduce((sum,x)=>sum+(x-.5)**2,0)/displayed.length);
    assert.ok(rms<.008,'Smoothed jitter is less than half the raw 2% oscillation');
    marker.observe({x:.8,y:.5});for(let i=1;i<=12;i++)marker.step(1980+i*16);
    assert.ok(marker.position.x>.76,'Deliberate movements remain responsive');
});
test('subpixel noise stays still and missing wrists reset instead of dragging a stale marker',()=>{
    const marker=new MarkerMotion();marker.observe({x:.5,y:.5});marker.step(0);
    for(let i=1;i<20;i++){marker.observe({x:.5+(i%2?.001:-.001),y:.5});marker.step(i*16);}
    assert.equal(marker.position.x,.5);
    marker.observe(null);assert.equal(marker.step(1000),null);
    marker.observe({x:.9,y:.3});assert.deepEqual(marker.step(1016),{x:.9,y:.3});
});

test('inward horizontal sweeps never introduce vertical drift in display smoothing',()=>{
    for(const start of [.15,.85]) {
        const marker=new MarkerMotion();marker.observe({x:start,y:.4});marker.step(0);
        for(let frame=1;frame<=60;frame++) {
            const x=start+(1-2*start)*frame/60;
            marker.observe({x,y:.4});
            assert.equal(marker.step(frame*50).y,.4);
        }
    }
});
