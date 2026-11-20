import test from 'node:test';
import assert from 'node:assert/strict';
import {orbital,ORBIT,mod,sectorDistance,reachFor,levelFor,flareSectors,gapFor} from '../arcade/games/y2k/orbital.js';
import {beat,BEAT,multFor,stepFor} from '../arcade/games/y2k/beat.js';
import {reactor,REACTOR,BAGS,pour,fusionPoints,deadlineFor} from '../arcade/games/y2k/reactor.js';
import * as theme from '../arcade/games/y2k.js';
import {diagrams,captions,lessons} from '../arcade/games/y2k/tutorials.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES,pressureMultiplier} from '../arcade/core/pressure.js';
import {lessonFor} from '../arcade/lessons.js';

function setup(factory,extra={}) {
    const sounds=[],results=[],ended={at:null};let pace=extra.pace??1;let g;
    const env={random:seededRandom(extra.seed??123),message(){},sound:e=>sounds.push(e),finish:t=>{results.push(t);ended.at??=g.state.time;},reducedMotion:!!extra.reducedMotion,
        get pace(){return pace;}};
    g=factory(env);g.start();
    return {g,s:g.state,sounds,results,ended,setPace:v=>{pace=v;},advance(seconds){
        for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));
    }};
}
const ramp=time=>.8*pressureMultiplier(time); // The host's gentle survival pace.

test('Orbital turns one sector per raise in both directions and wraps around the ring',()=>{
    const {g,s,sounds}=setup(orbital);
    assert.equal(s.sector,0);g.input({action:'left'});assert.equal(s.sector,5,'L turns anticlockwise');
    g.input({action:'right'});g.input({action:'right'});assert.equal(s.sector,1,'R turns clockwise');
    assert.equal(sounds.filter(e=>e.kind==='turn').length,3);assert.equal(s.inputFeedback.hideAll,true,'Feedback is drawn by the engine');
    assert.deepEqual([mod(-1),mod(7),sectorDistance(0,5),sectorDistance(1,4)],[5,1,1,3]);
});

test('Orbital breaks a comet in the shield sector, multiplies streaks, and a missed comet costs a life',()=>{
    const {g,s,advance,sounds}=setup(orbital);
    s.comets=[{id:90,kind:'rock',sector:0,at:.2,spawn:-5},{id:91,kind:'rock',sector:3,at:.4,spawn:-5},{id:92,kind:'rock',sector:3,at:60,spawn:50}];
    advance(.25);assert.equal(s.score,ORBIT.points);assert.equal(s.streak,1);assert.ok(sounds.some(e=>e.kind==='clear'));
    advance(.2);assert.equal(s.lives,2);assert.equal(s.streak,0);assert.ok(sounds.some(e=>e.kind==='miss'));
    assert.ok(s.effects.some(e=>e.kind==='break')&&s.effects.some(e=>e.kind==='impact'),'Both outcomes have object-local effects');
    assert.deepEqual([levelFor(0),levelFor(5),levelFor(6),levelFor(18),levelFor(99)],[1,1,2,4,4]);
    s.streak=5;s.comets=[{id:93,kind:'rock',sector:0,at:s.time+.05,spawn:0},{id:94,kind:'rock',sector:3,at:500,spawn:490}];advance(.1);
    assert.equal(s.score,ORBIT.points+ORBIT.points*2,'The sixth break in a row scores ×2');
});

test('Orbital star shards are optional bonus pickups and solar flares hurt only when they meet the shield',()=>{
    const {g,s,advance}=setup(orbital);
    s.comets=[{id:80,kind:'shard',sector:0,at:.1,spawn:-5},{id:81,kind:'shard',sector:2,at:.2,spawn:-5},
        {id:82,kind:'flare',sector:4,at:.3,spawn:-5},{id:83,kind:'flare',sector:0,at:.4,spawn:-5},{id:84,kind:'rock',sector:0,at:500,spawn:490}];
    advance(.15);assert.equal(s.score,ORBIT.shardPoints);assert.equal(s.lives,3);
    advance(.1);assert.equal(s.score,ORBIT.shardPoints,'A missed shard is harmless');assert.equal(s.lives,3);
    advance(.1);assert.equal(s.lives,3,'A flare away from the shield is harmless');
    advance(.1);assert.equal(s.lives,2,'A flare that meets the shield costs a life');
    // Flares never sit within one sector of either neighbouring comet, so they are off the short path.
    for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(const f of flareSectors(a,b)){assert.ok(sectorDistance(f,a)>=2&&sectorDistance(f,b)>=2);}
});

test('every Orbital comet is reachable from the previous one at one turn per 1.1 s, and new objects arrive in stages',()=>{
    for(let seed=1;seed<=6;seed++){
        const {s,advance,setPace}=setup(orbital,{seed});const seen=new Set(),rocks=[];
        while(s.time<150&&!s.ended){setPace(ramp(s.time));
            for(const c of s.comets)if(!seen.has(c.id)){seen.add(c.id);if(c.kind==='rock')rocks.push(c);else assert.ok(c.at>=ORBIT.shardFrom,`${c.kind} arrived during the opening`);if(c.kind==='flare')assert.ok(c.at>=ORBIT.flareFrom);}
            s.lives=3;advance(.5);}
        rocks.sort((a,b)=>a.at-b.at);
        for(let i=1;i<rocks.length;i++){const gap=rocks[i].at-rocks[i-1].at;assert.ok(gap>=ORBIT.minGap-1e-9);
            assert.ok(sectorDistance(rocks[i].sector,rocks[i-1].sector)<=reachFor(gap),`seed ${seed}: comet ${i} unreachable`);}
        assert.ok(s.comets.length<=ORBIT.ahead*2&&s.bursts.length<=6&&s.effects.length<=16,'Actors and effects stay bounded');
    }
    assert.equal(gapFor(1),ORBIT.gap);assert.equal(gapFor(10),ORBIT.minGap);
});

test('an Orbital player turning at most once a second makes sustained progress while an idle one loses',()=>{
    for(let seed=1;seed<=4;seed++){
        const p=setup(orbital,{seed});let last=-10;
        while(!p.results.length&&p.s.time<180){p.setPace(ramp(p.s.time));
            const next=p.s.comets.filter(c=>c.kind==='rock').sort((a,b)=>a.at-b.at)[0];
            if(next&&next.sector!==p.s.sector&&p.s.time-last>=1){p.g.input({action:mod(next.sector-p.s.sector)<=3?'right':'left'});last=p.s.time;}
            p.g.update(1/60);}
        assert.deepEqual(p.results,[],`seed ${seed} lost at ${p.s.time}`);assert.ok(p.s.blocked>60&&p.s.score>1500,`seed ${seed}: ${p.s.blocked} breaks`);
        const idle=setup(orbital,{seed});idle.advance(120);
        assert.deepEqual(idle.results,['Game over']);assert.ok(idle.ended.at<30,`idle lasted ${idle.ended.at}`);
    }
});

test('Chrome Beat judges each wrist and move inside a broad window, PERFECT on the line, and a stray move only breaks the streak',()=>{
    const {g,s,advance,sounds}=setup(beat);
    assert.deepEqual(s.notes.slice(0,4).map(n=>[n.lane,n.move,n.at]),BEAT.opening.map(([lane,at])=>[lane,'up',at]),'A fixed, gentle opening');
    advance(2.4);g.input({action:'left_up'});assert.equal(s.score,0);assert.equal(s.streak,0,'Too early is an empty raise');
    advance(.6);g.input({action:'right_up'});assert.equal(s.score,0,'The wrong wrist does not play the left lane');
    g.input({action:'left_left'});assert.equal(s.score,0);assert.equal(s.notes[0].judged,undefined,'A wrong move leaves the note playable');
    g.input({action:'left_up'});assert.equal(s.score,BEAT.perfectPoints);assert.equal(s.streak,1);assert.ok(sounds.some(e=>e.kind==='bounce'&&e.perfect));
    g.input({action:'right_up',at:4.6+.3});assert.equal(s.score,BEAT.perfectPoints+BEAT.goodPoints,'+.3 s is GOOD');assert.equal(s.streak,2);
    assert.equal(s.streak,2);advance(1.2);g.input({action:'left_up'});assert.equal(s.streak,0,'An empty raise breaks the streak');assert.equal(s.lives,3,'but costs nothing else');
    assert.deepEqual([multFor(0),multFor(8),multFor(24),multFor(99)],[1,2,4,4]);
});

test('Chrome Beat chords need both wrists, scratches need the shown sweep, static costs a life, and warm-up misses are free',()=>{
    const {g,s,advance}=setup(beat);
    s.notes=[{id:70,lane:'both',move:'up',kind:'note',at:1,hits:{}},{id:71,lane:'right',move:'left',kind:'note',at:3,hits:{}},
        {id:72,lane:'left',move:'up',kind:'static',at:5,hits:{}},{id:73,lane:'left',move:'up',kind:'note',at:7,hits:{}}];s.last=100;
    advance(1);g.input({action:'left_up'});assert.equal(s.score,0,'Half a chord waits');g.input({action:'right_up'});
    assert.equal(s.score,BEAT.perfectPoints*2,'A chord pays double');
    advance(2);g.input({action:'right_right'});assert.equal(s.streak,0);g.input({action:'right_left'});assert.equal(s.score,BEAT.perfectPoints*3);
    advance(2);g.input({action:'left_up'});assert.equal(s.lives,2,'Touching static costs a life');
    advance(2.5);assert.equal(s.lives,2,'A miss during the warm-up costs no life');
    s.notes=[{id:74,lane:'left',move:'up',kind:'note',at:BEAT.warmup+1,hits:{}},{id:75,lane:'right',move:'up',kind:'static',at:BEAT.warmup+2,hits:{}}];
    advance(BEAT.warmup+3-s.time);assert.equal(s.lives,1,'After the warm-up a miss costs a life; untouched static is harmless');
});

test('Chrome Beat introduces chords, scratches and static in stages and keeps at least one second between notes',()=>{
    for(let seed=1;seed<=4;seed++){
        const {s,advance,setPace}=setup(beat,{seed});const seen=new Map();
        while(s.time<120){setPace(ramp(s.time));for(const n of s.notes)seen.set(n.id,n);s.lives=3;advance(.25);}
        const all=[...seen.values()].sort((a,b)=>a.at-b.at);
        for(let i=1;i<all.length;i++)assert.ok(all[i].at-all[i-1].at>=BEAT.minStep-1e-9);
        assert.ok(all.filter(n=>n.lane==='both').every(n=>n.at>=BEAT.chordFrom));
        assert.ok(all.filter(n=>n.move!=='up').every(n=>n.at>=BEAT.scratchFrom));
        assert.ok(all.filter(n=>n.kind==='static').every(n=>n.at>=BEAT.staticFrom));
        for(const kind of [n=>n.lane==='both',n=>n.move!=='up',n=>n.kind==='static'])assert.ok(all.some(kind),'Every stage actually appears');
        assert.ok(s.notes.length<=8&&s.bursts.length<=6&&s.effects.length<=16,'Bounded notes and effects');
    }
    assert.equal(stepFor(1),BEAT.step);assert.equal(stepFor(9),BEAT.minStep);
});

test('a Chrome Beat player with one decision per second sustains play; an idle one loses after the warm-up',()=>{
    for(let seed=1;seed<=4;seed++){
        const p=setup(beat,{seed});const played=new Set();let last=-10,minGap=Infinity;
        while(!p.results.length&&p.s.time<180){p.setPace(ramp(p.s.time));
            for(const n of p.s.notes){if(n.kind==='static'||played.has(n.id)||p.s.time<n.at+.05)continue;
                played.add(n.id);minGap=Math.min(minGap,p.s.time-last);last=p.s.time;
                for(const w of n.lane==='both'?['left','right']:[n.lane])p.g.input({action:`${w}_${n.move}`});}
            p.g.update(1/60);}
        assert.deepEqual(p.results,[]);assert.ok(minGap>=1,`decisions ${minGap.toFixed(2)} s apart`);assert.ok(p.s.hits>100&&p.s.score>8000);
        const idle=setup(beat,{seed});idle.advance(60);assert.deepEqual(idle.results,['Game over']);assert.ok(idle.ended.at>BEAT.warmup);
    }
});

test('Reactor pours an orb into the chosen core after the chord window, fuses at exactly 10 and melts down above it',()=>{
    assert.deepEqual(pour(7,3),{next:0,outcome:'fusion',reached:10});assert.deepEqual(pour(8,3),{next:0,outcome:'meltdown',reached:11});
    assert.deepEqual(pour(2,-3),{next:0,outcome:'fill',reached:0});assert.deepEqual(pour(4,2),{next:6,outcome:'fill',reached:6});
    assert.deepEqual([fusionPoints(1),fusionPoints(3),fusionPoints(9),fusionPoints(2,true)],[100,300,400,400]);
    const {g,s,advance,sounds}=setup(reactor);
    g.input({action:'left'});assert.equal(s.orb,null,'Nothing to pour before the first orb');
    advance(1);assert.ok(s.orb);s.orb.value=3;g.input({action:'left'});g.input({action:'left'});
    assert.deepEqual(s.cores,[0,0],'The single raise waits out the chord window');assert.equal(s.aim.side,'left','but lights the pipe at once');
    advance(.15);assert.deepEqual(s.cores,[3,0]);assert.equal(s.score,REACTOR.fillPoints,'A duplicate raise pours once');
    advance(.5);s.cores=[7,9];s.orb.value=3;g.input({action:'left'});advance(.15);
    assert.equal(s.score,REACTOR.fillPoints+100);assert.equal(s.fusions,1);assert.equal(s.vents,REACTOR.vents+1);assert.ok(sounds.some(e=>e.kind==='clear'));
    advance(.5);s.orb.value=2;g.input({action:'right'});advance(.15);
    assert.equal(s.lives,2);assert.equal(s.streak,0);assert.deepEqual(s.cores,[0,0]);assert.ok(sounds.some(e=>e.kind==='miss'));
});

test('Reactor vents on a chord in either order while charges last, spills an orb left past its fuse, and flushes a last-moment raise',()=>{
    const {g,s,advance}=setup(reactor);advance(1);
    for(const first of ['left','right']){
        const vents=s.vents;g.input({action:first});advance(.06);g.input({action:first==='left'?'right':'left'});
        assert.equal(s.orb,null);assert.equal(s.vents,vents-1);assert.deepEqual(s.cores,[0,0],'A vent pours nothing');advance(.5);
    }
    assert.equal(s.vents,0);const orb=s.orb;g.input({action:'left'});g.input({action:'right'});
    assert.equal(s.orb,orb,'No charge left: the vent is refused and the orb stays');assert.ok(s.bursts.some(b=>b.text==='NO VENT'));
    s.orb.deadline=s.time+.05;s.orb.value=1;g.input({action:'right'});advance(.06);
    assert.deepEqual(s.cores,[0,1],'A raise just before the fuse runs out is used');assert.equal(s.lives,3);
    advance(.5);advance(deadlineFor(1)+.05);assert.equal(s.lives,2,'An orb left past its fuse spills');assert.ok(s.bursts.some(b=>b.text==='SPILL'));
    g.input({action:'left'});g.pause();assert.equal(s.pending,null,'Pause discards a pending pour');
});

test('Reactor deals balanced bags that add coolant, big orbs and sparks in stages; sparks double a fusion',()=>{
    const {s,advance,setPace}=setup(reactor,{seed:9});const seen=[];
    while(s.time<100){setPace(ramp(s.time));if(s.orb&&seen.at(-1)?.orb!==s.orb)seen.push({orb:s.orb,at:s.time});s.lives=3;if(s.orb)s.orb.deadline=s.time+10;
        if(s.orb&&s.time-s.orb.born>.2){s.cores=[0,0];s.orb=null;s.nextAt=s.time+.1;}advance(.05);}
    assert.ok(seen.filter(x=>x.at<REACTOR.stages[1]-1).every(x=>x.orb.value>=1&&x.orb.value<=3&&!x.orb.spark),'The opening is 1-3 only');
    assert.ok(seen.some(x=>x.orb.value<0)&&seen.some(x=>x.orb.value===4),'Coolant and big orbs arrive');
    assert.ok(seen.some(x=>x.orb.spark)&&seen.filter(x=>x.orb.spark).every(x=>x.at>=REACTOR.stages[2]-1),'Sparks only in the last stage');
    assert.equal(BAGS[0].reduce((a,o)=>a+o.value,0),12);
    const p=setup(reactor);p.advance(1);p.s.cores=[8,0];p.s.orb.value=2;p.s.orb.spark=true;p.g.input({action:'left'});p.advance(.15);
    assert.equal(p.s.score,fusionPoints(1,true));
});

test('a Reactor player deciding at most once a second keeps fusing; an idle reactor spills into Game over',()=>{
    for(let seed=1;seed<=4;seed++){
        const p=setup(reactor,{seed});let last=-10;
        while(!p.results.length&&p.s.time<150){p.setPace(ramp(p.s.time));const o=p.s.orb;
            if(o&&p.s.time-o.born>.6&&p.s.time-last>=1&&!p.s.pending){
                const value=c=>{const r=pour(p.s.cores[c],o.value);return r.outcome==='fusion'?100:r.outcome==='meltdown'?-100:r.reached-(r.reached===9?3:0);};
                const a=value(0),b=value(1);
                if(a<0&&b<0&&p.s.vents){p.g.input({action:'left'});p.g.input({action:'right'});}else p.g.input({action:a>=b?'left':'right'});last=p.s.time;}
            p.g.update(1/60);}
        assert.ok(p.s.fusions>=18,`seed ${seed}: ${p.s.fusions} fusions by ${p.s.time.toFixed(0)} s`);assert.ok(p.s.time>=120);
        const idle=setup(reactor,{seed});idle.advance(60);assert.deepEqual(idle.results,['Game over']);assert.ok(idle.ended.at<20);
        assert.ok(p.s.bursts.length<=6&&p.s.effects.length<=16&&p.s.queue.length===REACTOR.preview);
    }
});

test('reduced motion leaves every Y2K rule, score and random sequence unchanged',()=>{
    for(const factory of [orbital,beat,reactor]){
        const a=setup(factory,{seed:4}),b=setup(factory,{seed:4,reducedMotion:true});
        for(let i=0;i<4000&&!a.results.length;i++){if(i%97===0){for(const run of [a,b])run.g.input({action:factory===beat?'left_up':i%2?'left':'right'});}a.g.update(.02);b.g.update(.02);}
        assert.deepEqual(a.s,b.s);
    }
});

test('Y2K runs pause, restart and end through the shared runner with Game over',()=>{
    for(const engine of ['orbital','beat','reactor']){
        const description=games.find(game=>game.id===`y2k-${engine}`);let now=0;
        const runner=new GameRunner({...description,seed:7},engines[engine],{clock:()=>now});runner.play();
        for(let i=0;i<30;i++){now+=100;runner.step(now);}
        runner.pause();const elapsed=runner.elapsed,state=structuredClone(runner.game.state);
        now+=5000;runner.step(now);assert.equal(runner.elapsed,elapsed);assert.deepEqual(runner.game.state,state);
        runner.play();while(runner.phase==='playing'&&now<400000){now+=100;runner.step(now);}
        assert.equal(runner.phase,'finished');assert.equal(runner.resultText,'Game over');
        runner.restart();assert.equal(runner.phase,'playing');assert.equal(runner.game.state.score,0);assert.equal(runner.game.state.lives,3);
    }
});

test('Y2K catalog lines select the illustrated host policy, the right input scheme, precision and versioned scores',()=>{
    assert.deepEqual(Object.keys(theme).sort(),['beat','orbital','reactor']);
    for(const [engine,file,precision] of [['orbital','wrist-up-only','low'],['beat','popup-directions','full'],['reactor','wrist-up-only','low']]){
        const description=games.find(game=>game.id===`y2k-${engine}`),config=gameConfig(description);
        assert.equal(engines[engine],theme[engine]);
        assert.equal(config.profileFile,file);assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(description.precision,precision);assert.equal(description.scoreVersion,2);
        assert.equal(PRESSURE_RULES[engine].kind,'survival');assert.equal(livesLabel(engine),'Lives');
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        assert.equal(readChallenge(challengeLink('https://example.com/',description,{name:'CHROM',score:100}),games).rules,2);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'CHROM',score:999}),games),null);
        assert.equal(diagrams[engine].length,3);assert.equal(captions[engine].length,3);
        assert.ok(diagrams[engine].every(svg=>svg.includes('y2k-diagram')));assert.ok(lessonFor(engine).tip.length>100);
    }
    assert.deepEqual(Object.keys(games.find(game=>game.id==='y2k-beat').controls).sort(),['left_left','left_right','left_up','right_left','right_right','right_up']);
});
