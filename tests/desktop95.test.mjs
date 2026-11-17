import test from 'node:test';
import assert from 'node:assert/strict';
import {sort,stack,ski} from '../arcade/games/desktop95.js';
import {seededRandom} from '../arcade/core/random.js';
const setup=factory=>{const e={random:seededRandom(32),pace:1,message(){},finished:false,finish(text){e.finished=true;e.result=text;}};return {e,g:factory(e)};};
test('folder sort previews files, rewards a real series, and ignores receipt-time duplicate inputs',()=>{
    const {g}=setup(sort);g.state.lives=2;
    for(let i=0;i<5;i++){g.input({action:g.state.correct});const score=g.state.score;g.input({action:'right'});assert.equal(g.state.score,score);g.update(.5);}
    assert.equal(g.state.sorted,5);assert.equal(g.state.lives,3);assert.equal(g.state.queue.length,2);
});
test('folder sort ends without hands and is deterministic across render-independent runs',()=>{
    for(let repeat=0;repeat<2;repeat++){const {g,e}=setup(sort);for(let i=0;i<1000&&!e.finished;i++)g.update(.05);assert.ok(e.finished);assert.equal(e.result,'Game over');assert.equal(g.state.score,0);}
});
test('window snap restores width, while reversing cannot earn points',()=>{
    const {g}=setup(stack);g.state.x=230;g.input({action:'left'});assert.equal(g.state.score,40);assert.equal(g.state.width,282);
    const n=g.state.layers.length;g.input({action:'right'});assert.equal(g.state.score,40);assert.equal(g.state.layers.length,n);
    g.state.x=650;g.input({action:'left'});assert.equal(g.state.lives,2);assert.equal(g.state.layers.length,n);assert.equal(g.state.perfect,0);
});
test('ski gates always keep adjacent routes and a no-input run eventually loses',()=>{
    const {g,e}=setup(ski);let previous=1;
    for(let frame=0;frame<4000&&!e.finished;frame++){
        g.update(.05);
        for(const gate of g.state.gates){assert.ok(Math.abs(gate.gap-previous)<=1);previous=gate.gap;}
    }
    assert.ok(e.finished);assert.equal(g.state.lives,0);
});

test('small overlaps trim exactly to their support instead of growing beyond it',()=>{
    const {g}=setup(stack);g.state.x=445;g.input({action:'left'});
    assert.equal(g.state.width,50);assert.equal(g.state.layers.at(-1).width,50);
    g.state.x=g.state.layers.at(-1).x+24;g.input({action:'left'});
    assert.equal(g.state.width,62);assert.equal(g.state.score,60,'The entire marked snap band remains valid for a narrow window');
});

test('desktop95 timed actions do not change state while paused or after dispose',()=>{
    for(const factory of [sort,stack,ski]){
        const {g}=setup(factory);g.start();g.update(.3);g.pause();
        const before=structuredClone(g.state);g.input({action:'left'});g.update(2);
        assert.deepEqual(g.state,before);g.resume();g.update(.1);g.dispose();
        const ended=structuredClone(g.state);g.update(2);g.input({action:'right'});assert.deepEqual(g.state,ended);
    }
});
