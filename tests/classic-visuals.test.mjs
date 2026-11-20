import test from 'node:test';
import assert from 'node:assert/strict';
import {recordingPainter} from './visual-painter.mjs';
import {sort,stack,ski} from '../arcade/games/desktop95.js';
import {seededRandom} from '../arcade/core/random.js';

/** Plays a run while rendering every frame at desktop and phone sizes; returns the final state. */
export function playRendered(factory,{reducedMotion=false,seconds=40,seed=77,actions=['left','right'],every=37,phoneHeight=740}={}) {
    let draws=0;const random=seededRandom(seed);
    const env={pace:1,random:()=>{draws++;return random();},reducedMotion,message(){},sound(){},finish(){}};
    const g=factory(env);g.start();
    const desktop=recordingPainter({},420),phone=recordingPainter({},phoneHeight,true);
    for(let frame=0;frame<seconds*30;frame++){
        if(frame%every===0)g.input({action:actions[Math.floor(frame/every)%actions.length]});
        g.update(1/30);
        const before=draws;g.render(desktop);g.render(phone);
        assert.equal(draws,before,'render consumed gameplay RNG');
    }
    return {state:structuredClone(g.state),desktop,phone};
}

for(const [name,factory] of [['sort',sort],['stack',stack],['ski',ski]]){
    test(`Desktop95 ${name}: shell animations and reduced motion leave rules, scores and RNG identical`,()=>{
        assert.deepEqual(playRendered(factory,{reducedMotion:true}).state,playRendered(factory).state);
    });
}

test('Desktop95 windows do not repeat the room title, score or lives, and phone text stays legible',()=>{
    for(const [title,factory] of [['Folder Sort',sort],['Window Stack',stack],['Ski Run',ski]]){
        const g=factory({pace:1,random:seededRandom(3),message(){},sound(){},finish(){}});g.start();g.update(.5);
        const p=recordingPainter({},740,true);g.render(p);
        const labels=p.c.fills.filter(fill=>fill[0]==='label');
        assert.ok(!labels.some(label=>label[2].includes(title)),`${title} repeated on the canvas`);
        assert.ok(!labels.some(label=>/\bpts\b|♥/.test(label[2])),'score or hearts repeated on the canvas');
        for(const label of labels)assert.ok(label[5]>=22,`${label[2]} is ${label[5]} logical px on a phone`);
    }
});

import {popups} from '../arcade/games/popup-panic.js';
import {maze} from '../arcade/games/link-maze.js';
import {juggle} from '../arcade/games/gif-juggler.js';

test('Construction sparkles, starfield, tape and marquee never change rules, scores or RNG',()=>{
    for(const factory of [maze,juggle])
        assert.deepEqual(playRendered(factory,{reducedMotion:true,every:23}).state,playRendered(factory,{every:23}).state);
    // Pop-up Panic already settles rows instantly under reduced motion; its rules and scores must still match.
    const actions=['left_up','right_left','left_right','right_up','left_left','right_right'];
    const full=playRendered(popups,{actions,every:19}).state,reduced=playRendered(popups,{actions,every:19,reducedMotion:true}).state;
    for(const key of ['score','cleared','level','chain','serial','queue','bag'])assert.deepEqual(reduced[key],full[key],key);
    assert.deepEqual(reduced.windows.map(w=>[w.id,w.stack,w.direction]),full.windows.map(w=>[w.id,w.stack,w.direction]));
});

test('Construction canvases do not repeat the room title',()=>{
    for(const [title,factory] of [['LINK MAZE',maze],['GIF JUGGLER',juggle]]){
        const g=factory({pace:1,random:seededRandom(3),message(){},sound(){},finish(){}});g.start();g.update(.5);
        const p=recordingPainter({},740,true);g.render(p);
        assert.ok(!p.c.fills.some(fill=>fill[0]==='label'&&fill[2].toUpperCase().includes(title)),`${title} repeated`);
    }
});
