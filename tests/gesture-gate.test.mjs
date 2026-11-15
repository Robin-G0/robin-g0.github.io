import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureGate } from '../arcade/mig/gesture-gate.js';

test('wrist cooldowns cover all directions independently and discarded events are never replayed',()=>{
    const gate=new GestureGate({cooldownMs:200}),visible={left:true,right:true};
    const send=(actions,timestamp,v=visible)=>gate.consume(actions.map(action=>({action,timestamp})),v).map(e=>e.action);
    assert.deepEqual(send(['left_left'],1000),['left_left']);
    assert.deepEqual(send(['left_up','right_right'],1100),['right_right']);
    assert.deepEqual(send(['left_up','right_up'],1199),[]);
    assert.deepEqual(send(['left_up','right_up'],1200),['left_up']);
    assert.deepEqual(send(['left_right','right_up'],1300),['right_up']);
    assert.deepEqual(send([],1500),[],'Expired cooldowns never deliver queued commands');
    assert.deepEqual(send(['left_right','right_left'],1500),['left_right','right_left']);
});

test('tracking flicker and ambiguous batches cannot bypass or extend wrist cooldowns',()=>{
    const gate=new GestureGate({cooldownMs:200}),visible={left:true,right:true};
    const send=(actions,timestamp,v=visible)=>gate.consume(actions.map(action=>({action,timestamp})),v).map(e=>e.action);
    assert.deepEqual(send(['left_up','right_left'],1000),['left_up','right_left']);
    send([],1050,{left:false,right:false});
    assert.deepEqual(send(['left_right','right_up'],1100),[]);
    assert.deepEqual(send(['left_right','left_left','right_up'],1200),['right_up']);
    assert.deepEqual(send(['left_right'],1201),['left_right'],'Ambiguity did not start a fresh cooldown');
    assert.deepEqual(send(['left_left'],1199),[],'Out-of-order delivery cannot move the deadline backwards');
    gate.reset();assert.deepEqual(send(['left_up'],1202),['left_up']);
});
