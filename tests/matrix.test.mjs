import test from 'node:test';
import assert from 'node:assert/strict';
import {parry,PARRY,stageAt as parryStage,blockPoints,movesFor,travelSeconds,spawnInterval,bandStart} from '../arcade/games/matrix/parry.js';
import {binary,BINARY,apply,shortest,bestMove,makeLock,stageFor,depthFor} from '../arcade/games/matrix/binary.js';
import {gravity,GRAVITY,collides,collects,stageAt as gravityStage,worldSpeed,rowInterval} from '../arcade/games/matrix/gravity.js';
import * as theme from '../arcade/games/matrix.js';
import {diagrams,captions,lessons} from '../arcade/games/matrix/tutorials.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';

const DT=1/60;
function setup(factory,extra={}) {
    const sounds=[],results=[];
    const env={pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra};
    const g=factory(env);
    g.start();return {g,s:g.state,env,sounds,results,advance(seconds){
        for(let left=seconds;left>1e-8;left-=DT)g.update(Math.min(left,DT));
    }};
}
const pressure=t=>1+.7*Math.log1p(t/40);

// ---------- Construct Parry ----------

test('Parry: each wrist answers its own side; the arrow decides block or sweep; late answers score more',()=>{
    const {g,s,advance,sounds}=setup(parry);
    s.nextSpawn=1e9;
    const strike=(side,move,p)=>{const x={id:Math.random(),side,move,release:0,travel:2,p,contactAt:null};s.strikes.push(x);return x;};
    strike('left','up',.3);
    g.input({action:'left_up'});assert.equal(s.score,0,'Before the guard zone nothing is blocked');assert.equal(s.strikes.length,1);
    s.strikes[0].p=.55;g.input({action:'right_up'});assert.equal(s.score,0,'The other wrist does not guard this side');
    g.input({action:'left_left'});assert.equal(s.score,0,'A sweep does not answer a block');assert.equal(s.lives,3,'Mismatched moves are harmless');
    g.input({action:'left_up'});assert.equal(s.score,10,'Zone edge scores 10');
    strike('right','right',.85);g.input({action:'right_right'});assert.equal(s.score,10+25,'Later in the zone scores more');
    strike('left','right',.95);g.input({action:'left_right'});assert.equal(s.score,35+50,'An inward sweep at contact is a parry');
    assert.ok(s.bursts.some(b=>b.text==='PARRY +50'));assert.ok(sounds.some(e=>e.kind==='bounce'&&e.perfect));
    assert.deepEqual([blockPoints({side:'left'},.55).points,blockPoints({side:'left'},.76).points,blockPoints({side:'left'},.92).points],[10,20,50]);
    assert.equal(blockPoints({side:'center'},.95).points,100,'Heavy strikes double');
    // One move answers every matching strike in its zone (a flurry).
    strike('left','up',.7);strike('left','up',.9);
    g.input({action:'left_up'});assert.equal(s.strikes.length,0);assert.ok(s.bursts.some(b=>b.text.startsWith('FLURRY x2')));
    assert.equal(s.streak,5);
    advance(.1);
});

test('Parry: a heavy strike needs both wrists up within the guard window, in either order',()=>{
    for(const order of [['left_up','right_up'],['right_up','left_up']]){
        const {g,s,advance}=setup(parry);s.nextSpawn=1e9;
        s.strikes.push({id:1,side:'center',move:'up',release:0,travel:3,p:.5,contactAt:null});
        g.input({action:order[0]});assert.equal(s.strikes.length,1,'One wrist is not enough');
        advance(1);g.input({action:order[1]});
        assert.equal(s.strikes.length,0);assert.ok(s.score>=40);
    }
    const {g,s,advance}=setup(parry);s.nextSpawn=1e9;
    s.strikes.push({id:1,side:'center',move:'up',release:0,travel:30,p:.5,contactAt:null});
    g.input({action:'left_up'});advance(PARRY.guardWindow+.1);g.input({action:'right_up'});
    assert.equal(s.strikes.length,1,'A guard lowered too long ago does not count');
});

test('Parry: an unanswered strike hits after a short grace, costs one life once and clears the board',()=>{
    const {s,advance,results}=setup(parry);s.nextSpawn=1e9;
    s.strikes.push({id:1,side:'left',move:'up',release:0,travel:1,p:.99,contactAt:null},{id:2,side:'right',move:'up',release:0,travel:1,p:.99,contactAt:null});
    advance(.05);assert.equal(s.lives,3,'Contact starts the grace');
    advance(PARRY.grace);assert.equal(s.lives,2,'Two simultaneous hits cost a single life');assert.equal(s.strikes.length,0);
    assert.equal(s.streak,0);assert.deepEqual(results,[]);
});

test('Parry: mechanics arrive in stages and bullet time is earned by a streak',()=>{
    assert.deepEqual([0,19.9,20,40,60,85].map(parryStage),[0,0,1,2,3,4]);
    assert.deepEqual(movesFor(0),['up']);assert.deepEqual(movesFor(1),['up','out']);assert.deepEqual(movesFor(2),['up','out','in']);
    assert.equal(travelSeconds(1),PARRY.travel);assert.equal(travelSeconds(9),PARRY.minTravel);assert.equal(spawnInterval(9),PARRY.minInterval);
    const {g,s,advance}=setup(parry);
    advance(3);assert.ok(s.strikes.length>0,'Strikes arrive at once');
    assert.ok(s.strikes.every(x=>x.move==='up'));
    {const {g,s,advance}=setup(parry);s.nextSpawn=1e9;
    for(let i=0;i<PARRY.focusEvery;i++){s.strikes.push({id:i,side:'left',move:'up',release:0,travel:2,p:.8,contactAt:null});g.input({action:'left_up'});advance(.01);}
    assert.ok(s.time<s.focusUntil,'Six blocks in a row start bullet time');
    const world=s.world;advance(1);assert.ok(Math.abs(s.world-world-PARRY.focusFactor)<.02,'World time runs at half speed');}
});

function playParry(seed,seconds,{reducedMotion=false}={}) {
    const results=[];const env={pace:1,random:seededRandom(seed),message(){},sound(){},finish:t=>results.push(t),reducedMotion};
    const g=parry(env),s=g.state;g.start();let last=-10,inputs=0,minGap=Infinity;
    const send=action=>{minGap=Math.min(minGap,s.time-last);last=s.time;inputs++;g.input({action});};
    while(s.time<seconds&&!results.length){
        env.pace=pressure(s.time);g.update(DT);
        if(s.time-last<1)continue;
        const ready=s.strikes.filter(x=>s.world>=x.release&&x.p>=bandStart(x)).sort((a,b)=>b.p-a.p);
        const target=ready[0];if(!target)continue;
        if(target.side==='center'){
            const fresh=['left','right'].find(w=>s.time-s.guards[w]<=PARRY.guardWindow-.05);
            send(fresh==='left'?'right_up':'left_up');
        }else if(target.p>=.8||ready.length>1)send(`${target.side}_${target.move}`);
    }
    return {s,results,inputs,minGap};
}

test('Parry: a player answering at most once per second makes sustained progress through every stage',()=>{
    for(const seed of [1,2,3]){
        const {s,results,minGap}=playParry(seed,150);
        assert.ok(minGap>=1-1e-9,`inputs stay at least 1 s apart (${minGap})`);
        assert.deepEqual(results,[],`seed ${seed}: survived 150 s (lives ${s.lives}, score ${s.score})`);
        assert.ok(s.score>1500,`seed ${seed}: score ${s.score}`);assert.equal(s.stage,4);
        assert.ok(s.strikes.length<=PARRY.maxStrikes&&s.bursts.length<=6&&s.effects.length<=16,'Bounded arrays');
    }
});

test('Parry: idle play loses, and reduced motion leaves the rules unchanged',()=>{
    const a=setup(parry),b=setup(parry,{reducedMotion:true});
    for(let i=0;i<6000&&!a.results.length;i++){a.g.update(DT);b.g.update(DT);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<30,`lost after ${a.s.time}`);
    assert.deepEqual(a.s,b.s);
});

// ---------- Binary Lock ----------

test('Binary: L rotates the register, R flips the head bit unless that bit is sealed',()=>{
    assert.deepEqual(apply([1,0,0,1],[0,0,0,0],'left').bits,[0,0,1,1]);
    assert.deepEqual(apply([1,0,0,1],[0,1,0,0],'left').sealed,[1,0,0,0],'Seals travel with their bit');
    assert.deepEqual(apply([1,0,0,1],[0,0,0,0],'right').bits,[0,0,0,1]);
    assert.equal(apply([1,0,0,1],[1,0,0,0],'right').changed,false);
    assert.equal(shortest([1,0,0,0],[0,0,0,0],[0,1,0,0]),3,'three rotations bring the 1 round');
    assert.equal(shortest([0,1,0,0],[0,0,0,0],[1,0,0,0]),1,'a rotation alone');
    assert.equal(shortest([0,0,0,0],[0,0,0,0],[0,0,0,0]),0);
    assert.equal(shortest([1,0,0,0],[1,0,0,0],[0,0,0,0]),Infinity,'A sealed 1 can never become 0');
});

test('Binary: generated locks have the stated par, stages add bits and a seal',()=>{
    const random=seededRandom(9);
    for(let lock=1;lock<=14;lock++){
        const stage=stageFor(lock),depth=depthFor(lock,stage.bits),made=makeLock(random,stage.bits,stage.sealed,depth);
        assert.equal(made.bits.length,stage.bits);assert.equal(made.sealed.filter(Boolean).length,stage.sealed);
        assert.equal(shortest(made.bits,made.sealed,made.target),made.par);
        assert.ok(made.par>=1&&made.par<=depth);
    }
    assert.deepEqual([1,4,7,11].map(n=>[stageFor(n).bits,stageFor(n).sealed]),[[4,0],[5,0],[5,1],[6,1]]);
    assert.deepEqual([1,3,5,9].map(n=>depthFor(n,5)),[2,3,4,6]);
});

test('Binary: solving scores 20 per par move, doubled when clean; the clock waits while it opens; 3 clean runs restore an attempt',()=>{
    const {g,s,advance,sounds}=setup(binary);
    Object.assign(s,{bits:[1,0,0,0],sealed:[0,0,0,0],target:[0,1,0,0],par:3,moves:0});
    for(const action of ['left','left','left'])g.input({action});
    assert.equal(s.score,120);assert.equal(s.solved,true);assert.equal(s.cleanRun,1);assert.ok(sounds.some(e=>e.kind==='powerup'));
    g.input({action:'left'});assert.equal(s.moves,3,'Inputs during the opening animation are ignored');
    advance(BINARY.solveSeconds+.02);assert.equal(s.lock,2);assert.equal(s.solved,false);assert.equal(s.moves,0);
    Object.assign(s,{bits:[1,0,0,0],sealed:[0,0,0,0],target:[0,1,0,0],par:3,moves:0});
    g.input({action:'right'});g.input({action:'right'});assert.equal(s.solved,false);
    Object.assign(s,{bits:[0,1,0,0],sealed:[0,0,0,0],target:[1,0,0,0],par:1,moves:4});g.input({action:'left'});
    assert.equal(s.score,120+20,'Over par: no double');assert.equal(s.cleanRun,0);
    s.lives=2;s.knownLives=2;s.cleanRun=2;advance(BINARY.solveSeconds+.02);
    Object.assign(s,{bits:[0,1,0,0],sealed:[0,0,0,0],target:[1,0,0,0],par:1,moves:0});g.input({action:'left'});
    assert.equal(s.lives,3,'A third clean lock in a row restores an attempt');
    // A refused flip is harmless and visible.
    advance(BINARY.solveSeconds+.02);Object.assign(s,{bits:[1,0,0,0],sealed:[1,0,0,0],target:[1,1,0,0],moves:0});
    g.input({action:'right'});assert.equal(s.moves,0);assert.equal(s.refusedAt,s.time);
});

test('Binary: idle play times out through the host round clock and a timeout loads a fresh lock',()=>{
    const description=games.find(game=>game.id==='matrix-binary');
    let now=0;const runner=new GameRunner({...description,seed:3},engines.binary,{clock:()=>now});
    runner.play();const first=runner.game.state.target.join('')+runner.game.state.bits.join('');
    while(runner.game.state.lives===3&&now<100000){now+=100;runner.step(now);}
    now+=100;runner.step(now);
    assert.equal(runner.game.state.knownLives,2);
    assert.ok(runner.game.state.bursts.some(b=>b.text==='TRACE LOST'));
    while(runner.phase==='playing'&&now<400000){now+=100;runner.step(now);}
    assert.equal(runner.phase,'finished');assert.equal(runner.resultText,'Time up');
    assert.ok(runner.elapsed>60&&runner.elapsed<120,`${runner.elapsed}`);
    void first;
});

test('Binary: a planner moving once every 1.5 s keeps opening locks well past the old deadline',()=>{
    const description=games.find(game=>game.id==='matrix-binary');
    for(const seed of [1,2,3]){
        let now=0;const runner=new GameRunner({...description,seed},engines.binary,{clock:()=>now});
        runner.play();let last=-10;
        while(runner.phase==='playing'&&runner.elapsed<300){
            now+=50;runner.step(now);const s=runner.game.state;
            if(s.solved||runner.elapsed-last<1.5)continue;
            last=runner.elapsed;runner.game.input({action:bestMove(s.bits,s.sealed,s.target)});runner.updatePressure();
        }
        const s=runner.game.state;
        assert.equal(runner.phase,'playing',`seed ${seed} survived 300 s`);assert.ok(s.lock>=20,`seed ${seed}: ${s.lock} locks`);
        assert.ok(s.bursts.length<=6&&s.effects.length<=16);
    }
});

test('Binary: reduced motion leaves the rules and generated locks unchanged',()=>{
    const a=setup(binary),b=setup(binary,{reducedMotion:true});
    for(let i=0;i<200;i++){const action=i%3?'left':'right';a.g.input({action});b.g.input({action});a.advance(.3);b.advance(.3);}
    assert.deepEqual(a.s,b.s);
});

// ---------- Gravity Switch ----------

test('Gravity: ledges need the other wall, beams punish being mid-switch, pickups need their wall',()=>{
    assert.equal(collides({ledge:'left'},0),true);assert.equal(collides({ledge:'left'},1),false);assert.equal(collides({ledge:'left'},.5),true,'Mid-switch meets a ledge');
    assert.equal(collides({ledge:'right'},0),false);assert.equal(collides({beam:true},0),false);assert.equal(collides({beam:true},1),false);
    assert.equal(collides({beam:true},.5),true);
    assert.equal(collects({pickup:1},1),true);assert.equal(collects({pickup:1},0),false);
    assert.deepEqual([0,14.9,15,30].map(gravityStage),[0,0,1,2]);
    assert.equal(worldSpeed(5),GRAVITY.maxSpeed);assert.equal(rowInterval(9),GRAVITY.minInterval);
});

test('Gravity: raising a wall switches over in a third of a second; the same wall is harmless',()=>{
    const {g,s,advance,sounds}=setup(gravity);s.nextRow=1e9;
    g.input({action:'left'});assert.equal(sounds.length,0);
    g.input({action:'right'});advance(.16);assert.ok(s.x>.4&&s.x<.6);advance(.2);assert.equal(s.x,1);
    s.rows=[{id:1,d:.05,ledge:'left',beam:false,pickup:1},{id:2,d:.1,ledge:null,beam:false,pickup:1},{id:3,d:.15,ledge:null,beam:false,pickup:0}];
    advance(.2);
    assert.equal(s.score,10+10+20,'Pass 10, pickup x1 10, pickup x2 20');assert.equal(s.chain,0,'A missed pickup breaks the chain');
    assert.equal(s.lives,3);
    s.rows=[{id:4,d:.05,ledge:'right',beam:false,pickup:null}];advance(.1);
    assert.equal(s.lives,2);assert.ok(s.time<s.recoveryUntil);
    s.rows=[{id:5,d:.05,ledge:'right',beam:false,pickup:null}];advance(.1);assert.equal(s.lives,2,'Recovery forgives the next row');
});

test('Gravity: every eighth pickup opens a hardline: a bonus and a life',()=>{
    const {s,advance}=setup(gravity);s.nextRow=1e9;s.lives=2;
    for(let i=0;i<8;i++){s.rows=[{id:i,d:.02,ledge:null,beam:false,pickup:0}];advance(.05);}
    assert.equal(s.pickups,8);assert.equal(s.lives,3);
    assert.equal(s.score,10+20+30+40+50+50+50+50+GRAVITY.hardlinePoints,'Chain caps at x5');
});

function playGravity(seed,seconds,{reducedMotion=false}={}){
    const results=[];const env={pace:1,random:seededRandom(seed),message(){},sound(){},finish:t=>results.push(t),reducedMotion};
    const g=gravity(env),s=g.state;g.start();let last=-10,minGap=Infinity;
    while(s.time<seconds&&!results.length){
        env.pace=pressure(s.time);g.update(DT);
        if(s.time-last<1)continue;
        // Decide for the nearest threatening row; otherwise stay put.
        const v=worldSpeed(env.pace),rows=s.rows.filter(r=>r.d>0&&(r.ledge||r.beam)).sort((a,b)=>a.d-b.d);
        const next=rows.find(r=>r.ledge);if(!next)continue;
        const want=next.ledge==='left'?1:0;if(want===s.wall)continue;
        const beam=rows.find(r=>r.beam&&r.d<next.d);
        const eta=next.d/v,beamEta=beam?beam.d/v:Infinity;
        if(beam&&beamEta<GRAVITY.cross+.1)continue;           // let the beam pass first
        if(eta<1.6||beam){minGap=Math.min(minGap,s.time-last);last=s.time;g.input({action:want?'right':'left'});}
    }
    return {s,results,minGap};
}

test('Gravity: a player switching at most once per second keeps climbing for minutes',()=>{
    for(const seed of [1,2,3]){
        const {s,results,minGap}=playGravity(seed,180);
        assert.ok(minGap>=1-1e-9);
        assert.deepEqual(results,[],`seed ${seed}: lives ${s.lives} score ${s.score}`);
        assert.ok(s.passed>80,`seed ${seed}: passed ${s.passed}`);assert.ok(s.rows.length<=GRAVITY.maxRows);
    }
});

test('Gravity: idle play loses, and reduced motion leaves the rules unchanged',()=>{
    const a=setup(gravity),b=setup(gravity,{reducedMotion:true});
    for(let i=0;i<9000&&!a.results.length;i++){a.g.update(DT);b.g.update(DT);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<60,`${a.s.time}`);assert.deepEqual(a.s,b.s);
});

// ---------- Host integration ----------

test('Matrix engines: pause freezes, restart resets, and the theme entry re-exports all three',()=>{
    assert.deepEqual(Object.keys(theme).sort(),['binary','gravity','parry']);
    for(const engine of ['parry','binary','gravity']){
        const description=games.find(game=>game.engine===engine);
        let now=0;const runner=new GameRunner({...description,seed:5},engines[engine],{clock:()=>now});
        runner.play();for(let i=0;i<30;i++){now+=100;runner.step(now);}
        const time=runner.game.state.time;runner.pause();now+=5000;runner.step(now);
        assert.equal(runner.game.state.time,time,`${engine} pauses`);
        runner.play();now+=100;runner.step(now);assert.ok(runner.game.state.time>time);
        runner.restart();assert.equal(runner.game.state.time,0);assert.equal(runner.game.state.score,0);assert.equal(runner.game.state.lives,3);
        runner.dispose();
    }
});

test('Matrix engines use the illustrated host policy, versioned scores and three real tutorial cards',()=>{
    for(const [engine,version,directional,precision] of [['parry',2,true,'full'],['binary',2,false,'low'],['gravity',2,false,'low']]){
        const description=games.find(game=>game.engine===engine),config=gameConfig(description);
        assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(config.directional,directional);assert.equal(config.profileFile,directional?'popup-directions':'wrist-up-only');
        assert.equal(description.scoreVersion,version);assert.equal(description.precision,precision);
        if(directional)assert.deepEqual(Object.keys(description.controls).sort(),['left_left','left_right','left_up','right_left','right_right','right_up']);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        assert.equal(readChallenge(challengeLink('https://example.com/',description,{name:'NEO99',score:100}),games).rules,version);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'NEO99',score:999}),games),null);
        assert.equal(diagrams[engine].length,3);assert.equal(captions[engine].length,3);assert.equal(lessons[engine].length,3);
        assert.ok(diagrams[engine].every(svg=>svg.includes('matrix-diagram')));
    }
    assert.deepEqual(['parry','binary','gravity'].map(e=>PRESSURE_RULES[e].kind),['survival','rounds','survival']);
    assert.equal(PRESSURE_RULES.binary.seconds,24);
    assert.deepEqual(['parry','binary','gravity'].map(livesLabel),['Lives','Attempts','Lives']);
});
