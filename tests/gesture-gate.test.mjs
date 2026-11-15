import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureGate } from '../arcade/mig/gesture-gate.js';

const commands=['left_left','left_up','left_right','right_left','right_up','right_right'];
test('all six wrist/direction pairs have independent cooldowns without queued replays',()=>{
    const gate=new GestureGate({cooldownMs:200}),visible={left:true,right:true};
    const send=(actions,timestamp)=>gate.consume(actions.map(action=>({action,timestamp})),visible).map(e=>e.action);
    for(const action of commands)assert.deepEqual(send([action],1000),[action]);
    for(const action of commands)assert.deepEqual(send([action],1199),[]);
    assert.deepEqual(send([],1200),[],'Expired cooldowns never replay rejected commands');
    for(const action of commands)assert.deepEqual(send([action],1200),[action]);
});

test('tracking flicker, ambiguous batches and direction changes cannot bypass repeat cooldowns',()=>{
    const gate=new GestureGate({cooldownMs:200}),visible={left:true,right:true};
    const send=(actions,timestamp,v=visible)=>gate.consume(actions.map(action=>({action,timestamp})),v).map(e=>e.action);
    assert.deepEqual(send(['left_up','right_left'],1000),['left_up','right_left']);
    send([],1050,{left:false,right:false});
    assert.deepEqual(send(['left_up','right_left'],1100),[]);
    assert.deepEqual(send(['left_right','right_up'],1100),['left_right','right_up']);
    assert.deepEqual(send(['left_up'],1199),[],'Switching away and back does not erase the original direction deadline');
    assert.deepEqual(send(['left_up','left_left','right_left'],1200),['right_left']);
    assert.deepEqual(send(['left_up'],1201),['left_up'],'Ambiguity did not extend the original cooldown');
    assert.deepEqual(send(['left_left'],1199),[],'Out-of-order delivery is rejected even for a fresh direction');
    gate.reset();assert.deepEqual(send(['left_up'],1202),['left_up']);
});
