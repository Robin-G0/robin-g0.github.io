import test from 'node:test';
import assert from 'node:assert/strict';
import {marble,MARBLE,makeGates,firstGate,stageAt as marbleStage,multiplier} from '../arcade/games/aqua/marble.js';
import {gel,GEL,growSeconds,sizeAt,fitOf,slotFor,slotCount,cleanBonus} from '../arcade/games/aqua/gel.js';
import {dock,DOCK,APPS,needs,verbFor,requestPoints,fuseSeconds,spawnSeconds,stageAt as dockStage} from '../arcade/games/aqua/dock.js';
import * as aqua from '../arcade/games/aqua.js';
import {diagrams,captions,lessons} from '../arcade/games/aqua/tutorials.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES,pressureMultiplier} from '../arcade/core/pressure.js';
import {Painter} from '../arcade/core/painter.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const env={pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra};
    const g=factory(env);g.start();
    return {g,s:g.state,env,sounds,results,advance(seconds){for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));}};
}
/** A painter whose context accepts every call, so render paths run in Node (both appearance modes, both layouts). */
function painter(dark=false,compact=false) {
    const gradient={addColorStop(){}};
    const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get(target,key){return key in target?target[key]:()=>{};},set(){return true;}});
    const p=new Painter(context,dark?{bg:'#172431',ink:'#e6f5ff',muted:'#a9c4d7',accent:'#77c7ff',soft:'#28485f',border:'#4b6c87',gold:'#ffe19a'}
        :{bg:'#f5faff',ink:'#172e4c',muted:'#4e6481',accent:'#075fbb',soft:'#d1e9fd',border:'#9db7d0',gold:'#775d13'});
    p.compact=compact;p.h=compact?1560:420;return p;
}
const renderAll=g=>{for(const [dark,compact] of [[false,false],[true,false],[false,true],[true,true]])g.render(painter(dark,compact));};

// ---------------------------------------------------------------- Marble Gates
test('Marble Gates shelves: gates never sit under the previous gates, red only between two safe gates, kinds unlock by stage',()=>{
    const random=seededRandom(9);let previous=[3];
    for(let i=0;i<600;i++){
        const stage=i%4,gates=makeGates(random,previous,stage),lanes=gates.map(g=>g.lane);
        assert.ok(lanes.every(lane=>!previous.includes(lane)),'Every normal drop lands on metal');
        assert.deepEqual(lanes,[...lanes].sort((a,b)=>a-b));
        const close=gates.filter(g=>g.kind==='close');
        assert.ok(close.length<=1);
        if(close.length){assert.equal(gates.length,3);assert.equal(gates[1].kind,'close','A red gate is always the middle of three');}
        if(stage<1)assert.ok(gates.every(g=>g.kind==='plain'));
        if(stage<2)assert.equal(close.length,0);
        if(stage<3)assert.ok(gates.every(g=>g.kind!=='minimise'));
        // From any landing lane, at least one side's first gate is safe.
        for(let x=0;x<MARBLE.lanes;x++)if(!lanes.includes(x))
            assert.ok([-1,1].some(d=>{const gate=firstGate(gates,x,d);return gate&&gate.kind!=='close';}),`stuck at ${x} on ${JSON.stringify(gates)}`);
        previous=lanes;
    }
    assert.deepEqual([marbleStage(0),marbleStage(14.9),marbleStage(15),marbleStage(35),marbleStage(60)],[0,0,1,2,3]);
    assert.deepEqual([multiplier(0),multiplier(4),multiplier(5),multiplier(10),multiplier(99)],[1,1,2,3,4]);
    assert.equal(firstGate([{lane:1},{lane:5}],3,-1).lane,1);assert.equal(firstGate([{lane:1},{lane:5}],3,1).lane,5);assert.equal(firstGate([{lane:1}],3,1),null);
});

test('Marble Gates: a tilt rolls the marble into the first gate on that side; kinds score, cost a life or skip a shelf',()=>{
    const {g,s,advance,sounds}=setup(marble);
    // Lay out the shelf under the marble and the ones below it (top to bottom).
    const layout=(...rows)=>{const shelves=s.shelves.filter(x=>x.y>=s.ball.y-1e-9).sort((a,b)=>a.y-b.y);rows.forEach((gates,i)=>shelves[i].gates=gates);return shelves;};
    layout([{lane:1,kind:'plain'},{lane:6,kind:'zoom'}],[{lane:0,kind:'close'},{lane:3,kind:'zoom'},{lane:5,kind:'plain'}],[{lane:2,kind:'plain'},{lane:6,kind:'plain'}]);
    s.ball.x=3;
    g.input({action:'left'});assert.equal(s.tilt,-1);
    advance(.5);assert.ok(Math.abs(s.ball.x-(3-MARBLE.roll*.5))<.02,'Rolls at a fixed speed');
    advance(.4);assert.equal(s.ball.falling,true,'Reached lane 1, the first gate on the left');assert.equal(s.score,10);assert.equal(s.gates,1);
    assert.ok(sounds.some(e=>e.kind==='bounce'));
    g.input({action:'right'}); // Raised during the fall: kept for the landing.
    advance(1.6);
    assert.equal(s.score,40,'Rolled right from lane 1 into the zoom gate at lane 3: +30');
    advance(.5);assert.equal(s.ball.falling,false);assert.equal(s.tilt,0,'The tray levels after a landing');
    layout([{lane:0,kind:'plain'},{lane:4,kind:'close'},{lane:6,kind:'plain'}],[{lane:1,kind:'plain'},{lane:5,kind:'plain'}]);
    s.ball.x=3;g.input({action:'right'});advance(.5);
    assert.equal(s.lives,2,'A red close gate costs a life');assert.equal(s.streak,0);assert.equal(s.score,40);
    advance(.5);
    // Minimise: falls through the next shelf too and lands two shelves down.
    const high=s.shelves.filter(x=>x.y>1).sort((a,b)=>a.y-b.y)[0];Object.assign(s.ball,{shelf:high.id,y:high.y,falling:false});
    const rows=layout([{lane:5,kind:'minimise'}],[{lane:0,kind:'plain'}],[{lane:1,kind:'plain'}]);
    s.ball.x=4;g.input({action:'right'});advance(1.2);
    assert.equal(s.ball.shelf,rows[2].id,'Yellow minimise gate drops two shelves');assert.equal(s.score,60);
});

test('Marble Gates: the ceiling crushes, respawns with grace, the floor holds the marble and a rising shelf picks it up',()=>{
    const {g,s,advance,results}=setup(marble);
    const start=s.ball.shelf;
    while(s.lives===3&&s.time<20)advance(1/60);
    assert.equal(s.lives,2,'Idle marble reaches the ceiling and is crushed');assert.notEqual(s.ball.shelf,start);assert.ok(s.time>4);
    assert.ok(s.graceUntil>s.time);assert.ok(s.effects.some(e=>e.kind==='crush'));
    // Floor: a marble that falls with nothing below rests on the floor, then the next solid shelf lifts it.
    Object.assign(s.ball,{falling:true,y:MARBLE.floor-.01,shelf:null,x:3,fellAt:s.time});s.shelves=s.shelves.filter(x=>x.y<MARBLE.floor-.5);
    while(s.shelves.at(-1).y<MARBLE.depth)s.shelves.push({id:999+s.shelves.length,y:s.shelves.at(-1).y+1,gates:[{lane:0,kind:'plain'}]});
    advance(.05);assert.equal(s.ball.shelf,null);assert.equal(s.ball.y,MARBLE.floor);assert.equal(s.ball.falling,false);
    advance(4);assert.notEqual(s.ball.shelf,null,'A rising shelf picked the marble up');
    for(let i=0;i<8000&&!results.length;i++)g.update(1/60);
    assert.deepEqual(results,['Game over']);
});

test('Marble Gates: idle loses within a minute, reduced motion changes nothing, effects and shelves stay bounded',()=>{
    const a=setup(marble),b=setup(marble,{reducedMotion:true});
    for(let i=0;i<6000&&!a.results.length;i++){a.g.update(1/60);b.g.update(1/60);if(i%300===0){renderAll(a.g);renderAll(b.g);}}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<60,`idle lasted ${a.s.time}`);assert.equal(a.s.score,0);
    assert.deepEqual(a.s,b.s);
});

function marblePlayer(seed,seconds,smart=true){
    const results=[],rnd=seededRandom(seed+99),env={random:seededRandom(seed),pace:.8,message(){},sound(){},finish:t=>results.push(t)};
    const g=marble(env);g.start();const s=g.state;let last=-9,inputs=0,minGap=Infinity;
    while(!results.length&&s.time<seconds){
        env.pace=.8*pressureMultiplier(s.time);
        if(!s.ball.falling&&s.time-last>=1){
            const shelf=s.shelves.find(x=>x.id===s.ball.shelf);let action=null;
            if(!smart)action=rnd()<.5?'left':'right';
            else if(shelf){
                const options=[-1,1].map(d=>({d,gate:firstGate(shelf.gates,s.ball.x,d)})).filter(o=>o.gate&&o.gate.kind!=='close')
                    .sort((a,b)=>Math.abs(a.gate.lane-s.ball.x)-Math.abs(b.gate.lane-s.ball.x));
                if(options.length&&s.tilt!==options[0].d)action=options[0].d<0?'left':'right';
            }
            if(action){minGap=Math.min(minGap,s.time-last);g.input({action});last=s.time;inputs++;}
        }
        g.update(1/60);
        assert.ok(s.shelves.length<=10&&s.bursts.length<=6&&s.effects.length<=12,'Bounded actors and effects');
    }
    return {s,results,inputs,minGap};
}
test('Marble Gates: a reader with at least 1 s between tilts makes sustained progress; random tilting loses quickly',()=>{
    for(const seed of [1,2,3]){
        const skill=marblePlayer(seed,300),chance=marblePlayer(seed,300,false);
        assert.deepEqual(skill.results,[],`seed ${seed}: the reader lost`);assert.ok(skill.s.gates>=100,`seed ${seed}: ${skill.s.gates} gates`);
        assert.ok(skill.minGap>=1);assert.ok(Number.isSafeInteger(skill.s.score));
        assert.deepEqual(chance.results,['Game over'],`seed ${seed}: random ${chance.s.time} s, ${chance.s.score}`);assert.ok(chance.s.time<250&&chance.s.score<skill.s.score/3,`seed ${seed}: random ${chance.s.time} s, ${chance.s.score} vs ${skill.s.score}`);
    }
});

// ---------------------------------------------------------------- Gel Factory
test('Gel Factory sizing, fit bands, slot ownership and staged sheets',()=>{
    assert.equal(growSeconds(0),GEL.grow);assert.equal(growSeconds(100),GEL.minGrow);
    assert.equal(sizeAt(0,0),GEL.min);assert.ok(Math.abs(sizeAt(GEL.grow,0)-GEL.max)<1e-9);
    assert.deepEqual([fitOf(.63,.63),fitOf(.69,.63),fitOf(.5,.63),fitOf(.8,.63)],['perfect','good','small','big']);
    const slots=[{fill:null},{fill:'good'},{fill:null}];
    assert.equal(slotFor(slots,'left'),0);assert.equal(slotFor(slots,'right'),2);
    assert.equal(slotFor([{fill:null}],'left'),0);assert.equal(slotFor([{fill:null}],'right'),0,'A single slot belongs to either wrist');
    assert.equal(slotFor([{fill:'good'}],'left'),undefined);
    const random=seededRandom(4);
    assert.equal(slotCount(0,random),1);assert.equal(slotCount(2,random),1);assert.equal(slotCount(3,random),2);assert.equal(slotCount(7,random),2);
    const late=new Set(Array.from({length:50},()=>slotCount(9,random)));assert.deepEqual([...late].sort(),[2,3]);
    assert.deepEqual([cleanBonus(0),cleanBonus(1),cleanBonus(9)],[20,30,60]);
});

test('Gel Factory stamps the button at the gesture time, restarts it, and ships a full sheet for points',()=>{
    const {g,s,advance,sounds}=setup(gel);
    s.sheet.slots=[{size:'M',fill:null}];
    const when=(GEL.sizes.M-GEL.min)/(GEL.max-GEL.min)*GEL.grow;
    advance(when+.2);
    g.input({action:'right',at:s.time-.2});
    assert.equal(s.sheet.slots[0].fill,'perfect','Evaluated at the event time, not after recognition latency');
    assert.equal(s.score,GEL.points.perfect+cleanBonus(0));assert.equal(s.shipped,1);assert.equal(s.solved,true);
    assert.ok(sounds.some(e=>e.kind==='clear'));
    g.input({action:'left'});assert.equal(s.shipped,1,'Raises while a sheet ships are harmless');
    advance(GEL.ship+.01);assert.equal(s.solved,false);assert.notEqual(s.sheet.slots[0].fill,'perfect');
    // Misfits: no points, no life, the slot stays empty, the clean bonus is lost.
    s.sheet.slots=[{size:'S',fill:null},{size:'L',fill:null}];s.bornAt=s.time;
    advance(.05);g.input({action:'left'});
    assert.equal(s.sheet.slots[0].fill,null);assert.equal(s.lives,3);assert.equal(s.sheet.clean,false);assert.equal(s.cleanStreak,0);
    assert.ok(s.bursts.some(b=>b.text==='too small'));assert.ok(sounds.some(e=>e.kind==='brake'));
    assert.ok(Math.abs(s.bornAt-s.time-GEL.refill)<1e-9,'Every stamp starts a fresh button after a short refill');
    g.input({action:'right'});assert.equal(s.sheet.slots[1].fill,null,'No button during the refill: harmless');
    const grow=growSeconds(s.shipped),at=size=>(size-GEL.min)/(GEL.max-GEL.min)*grow;
    advance(GEL.refill+at(GEL.sizes.S)+.15);g.input({action:'left'});assert.equal(s.sheet.slots[0].fill,'good');
    advance(GEL.refill+at(GEL.sizes.L));g.input({action:'right'});assert.equal(s.sheet.slots[1].fill,'perfect');
    assert.equal(s.score,60+GEL.points.good+GEL.points.perfect,'No clean bonus after a misfit');assert.equal(s.cleanStreak,0);
    // Waiting too long pops the button harmlessly.
    advance(GEL.ship+.01);const pops=s.pops;advance(growSeconds(s.shipped)+.05);assert.equal(s.pops,pops+1);assert.equal(s.lives,3);
});

test('Gel Factory: idle play runs out of 18 s score rounds; a stamper with 1 s gaps keeps shipping for five minutes',()=>{
    const description=games.find(game=>game.id==='aqua-gel');
    let now=0;const idle=new GameRunner({...description,seed:5},engines.gel,{clock:()=>now});idle.play();
    while(idle.phase==='playing'&&now<400000){now+=100;idle.step(now);}
    assert.equal(idle.resultText,'Time up');assert.ok(idle.elapsed>45&&idle.elapsed<80,`idle ${idle.elapsed}`);
    for(const seed of [1,2,3]){
        now=0;const runner=new GameRunner({...description,seed},engines.gel,{clock:()=>now});runner.play();
        const s=runner.game.state,jitter=seededRandom(seed+50);let last=-9,inputs=0;
        while(runner.phase==='playing'&&runner.elapsed<300){
            now+=1000/60;runner.step(now);
            if(s.ship||runner.elapsed-last<1)continue;
            // Aim at the smaller of the two next targets; the stamp lands within ±.08 s of the right moment.
            const options=['left','right'].map(action=>({action,index:slotFor(s.sheet.slots,action)})).filter(o=>o.index!=null)
                .map(o=>({...o,size:GEL.sizes[s.sheet.slots[o.index].size]})).sort((a,b)=>a.size-b.size);
            const due=s.bornAt+(options[0].size-GEL.min)/(GEL.max-GEL.min)*growSeconds(s.shipped)+(jitter()-.5)*.16;
            if(s.time>=due&&s.time<due+.12){runner.game.input({action:options[0].action});last=runner.elapsed;inputs++;}
        }
        assert.equal(runner.phase,'playing',`seed ${seed}: ${runner.resultText}`);
        assert.ok(s.shipped>=40,`seed ${seed}: shipped ${s.shipped}`);assert.ok(s.bursts.length<=6&&s.effects.length<=12);
    }
});

test('Gel Factory reduced motion keeps rules identical',()=>{
    const a=setup(gel),b=setup(gel,{reducedMotion:true});
    for(let i=0;i<2400;i++){if(i%90===45){a.g.input({action:i%180?'left':'right'});b.g.input({action:i%180?'left':'right'});}
        a.g.update(1/60);b.g.update(1/60);if(i%200===0){renderAll(a.g);renderAll(b.g);}}
    assert.deepEqual(a.s,b.s);
});

// ---------------------------------------------------------------- Dock Bounce
test('Dock Bounce: sweeps glide one icon, L raise opens a bouncing app, R raise force-quits a hung one',()=>{
    const {g,s,advance,sounds}=setup(dock);
    assert.equal(s.cursor,DOCK.start);
    g.input({action:'left_left'});g.input({action:'right_left'});assert.equal(s.cursor,1,'Either wrist sweeps the pointer');
    g.input({action:'right_right'});assert.equal(s.cursor,2);
    s.cursor=0;g.input({action:'left_left'});assert.equal(s.cursor,0,'The end of the Dock is harmless');assert.equal(s.lives,3);
    g.input({action:'left_up'});assert.equal(s.score,0,'Clicking a quiet icon is harmless');
    advance(DOCK.first+.01);assert.equal(s.requests.length,1);assert.notEqual(s.requests[0].icon,0,'Never spawned under the pointer');
    s.requests=[{id:50,icon:1,kind:'bounce',urgent:false,born:s.time,due:s.time+10}];
    g.input({action:'left_right'});g.input({action:'right_up'});
    assert.equal(s.requests.length,1,'Force quit does not answer a bouncing app');assert.equal(s.lives,3,'A wrong verb costs no life');
    assert.ok(s.bursts.some(b=>b.text==='bouncing · L to open'));
    g.input({action:'left_up'});
    assert.equal(s.requests.length,0);assert.equal(s.score,DOCK.points.open+DOCK.speed,'Opened at once: base + full speed bonus');
    assert.ok(s.effects.some(e=>e.kind==='open'));assert.ok(sounds.some(e=>e.kind==='clear'));
    s.requests=[{id:51,icon:1,kind:'hang',urgent:true,born:s.time-6,due:s.time+6}];
    g.input({action:'right_up'});
    assert.equal(s.score,40+(DOCK.points.quit+DOCK.speed/2)*DOCK.urgent,'Quit, half the fuse left, urgent ×2');
    assert.deepEqual([needs({kind:'hang'}),needs({kind:'bounce'}),verbFor('left'),verbFor('right')],['quit','open','open','quit']);
    assert.equal(requestPoints({kind:'bounce',urgent:false,born:0,due:10},10),DOCK.points.open);
});

test('Dock Bounce: timeouts cost lives, every eighth answer restores one, stages add concurrency, hangs and urgency',()=>{
    const {g,s,advance}=setup(dock);
    s.requests=[{id:1,icon:5,kind:'bounce',urgent:false,born:0,due:.5}];s.nextSpawn=99;
    advance(.6);assert.equal(s.lives,2);assert.ok(s.bursts.some(b=>b.text==='not responding'));
    for(let i=0;i<DOCK.heartEvery;i++){s.requests=[{id:10+i,icon:s.cursor,kind:'bounce',urgent:false,born:s.time,due:s.time+5}];g.input({action:'left_up'});}
    assert.equal(s.lives,3,'Eight answers restore a life');
    assert.deepEqual([dockStage(0),dockStage(20),dockStage(40),dockStage(70)],[0,1,2,3]);
    assert.equal(fuseSeconds(1),DOCK.fuse);assert.equal(fuseSeconds(9),DOCK.minFuse);assert.equal(fuseSeconds(1,true),DOCK.fuse*DOCK.urgentFuse);
    assert.equal(spawnSeconds(1),DOCK.spawn);assert.equal(spawnSeconds(9),DOCK.minSpawn);
    const late=setup(dock,{random:seededRandom(8)});let kinds=new Set(),urgent=false,most=0;
    for(let i=0;i<120*60;i++){
        late.g.update(1/60);const st=late.s;
        most=Math.max(most,st.requests.length);for(const r of st.requests){kinds.add(r.kind);urgent||=r.urgent;
            if(r.born<DOCK.stages[2])assert.equal(r.kind,'bounce');if(r.born<DOCK.stages[3])assert.equal(r.urgent,false);}
        if(st.time<DOCK.stages[1])assert.ok(st.requests.length<=1);
        st.lives=3; // Keep the run alive to observe every stage.
    }
    assert.ok(kinds.has('hang'));assert.ok(urgent);assert.equal(most,3);
});

function dockPlayer(seed,seconds,gap=1){
    const results=[],env={random:seededRandom(seed),pace:.8,message(){},sound(){},finish:t=>results.push(t)};
    const g=dock(env);g.start();const s=g.state;let last=-9;
    while(!results.length&&s.time<seconds){
        env.pace=.8*pressureMultiplier(s.time);
        if(s.time-last>=gap&&s.requests.length){
            const options=s.requests.map(q=>({q,d:Math.abs(q.icon-s.cursor)}));
            const feasible=options.filter(o=>o.q.due-s.time>(o.d+1)*gap);
            const t=(feasible.length?feasible:options).sort((a,b)=>a.d-b.d||a.q.due-b.q.due)[0].q;
            g.input({action:t.icon===s.cursor?(needs(t)==='open'?'left_up':'right_up'):t.icon<s.cursor?'left_left':'right_right'});last=s.time;
        }
        g.update(1/60);assert.ok(s.requests.length<=3&&s.bursts.length<=6&&s.effects.length<=12);
    }
    return {s,results};
}
test('Dock Bounce: idle loses within a minute; a player with 1 s between moves serves dozens of apps for minutes',()=>{
    const idle=setup(dock),reduced=setup(dock,{reducedMotion:true});
    for(let i=0;i<6000&&!idle.results.length;i++){idle.g.update(1/60);reduced.g.update(1/60);if(i%300===0){renderAll(idle.g);renderAll(reduced.g);}}
    assert.deepEqual(idle.results,['Game over']);assert.ok(idle.s.time<45);assert.equal(idle.s.score,0);assert.deepEqual(idle.s,reduced.s);
    for(const seed of [1,2,3,4]){
        const {s}=dockPlayer(seed,600);
        assert.ok(s.time>=120,`seed ${seed}: lasted ${s.time}`);assert.ok(s.served>=30,`seed ${seed}: served ${s.served}`);
    }
});

// ---------------------------------------------------------------- Host integration
test('Aqua engines: catalog, profiles, pressure kinds, versioned scores, lessons and three cards each',()=>{
    assert.deepEqual(Object.keys(aqua).sort(),['dock','gel','marble']);
    for(const [engine,profile,precision,kind] of [['marble','wrist-up-only','low','survival'],['gel','wrist-up-only','low','rounds'],['dock','popup-directions','full','survival']]){
        const description=games.find(game=>game.engine===engine),config=gameConfig(description);
        assert.equal(description.theme,'aqua');assert.equal(description.illustrated,true);assert.equal(description.scoreVersion,2);
        assert.equal(config.profileFile,profile);assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(description.precision,precision);assert.equal(PRESSURE_RULES[engine].kind,kind);
        assert.equal(engines[engine],aqua[engine]);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        assert.equal(readChallenge(challengeLink('https://example.com/',description,{name:'AQUA1',score:100}),games).rules,2);
        assert.equal(diagrams[engine].length,3);assert.equal(captions[engine].length,3);assert.equal(lessons[engine].length,3);
        for(const svg of diagrams[engine])assert.match(svg,/class="guide-art aqua-diagram"/);
    }
    assert.equal(PRESSURE_RULES.gel.seconds,18);
    assert.deepEqual(['marble','gel','dock'].map(livesLabel),['Lives','Attempts','Lives']);
    const dockGame=games.find(game=>game.engine==='dock');
    assert.equal(dockGame.inputScheme,'wrist-directions');assert.equal(gameConfig(dockGame).directional,true);
    assert.deepEqual(Object.keys(dockGame.controls).sort(),['left_left','left_right','left_up','right_left','right_right','right_up']);
});

test('Aqua engines pause, resume and restart through the runner without losing or replaying time',()=>{
    for(const engine of ['marble','gel','dock']){
        const description=games.find(game=>game.engine===engine);let now=0;
        const runner=new GameRunner({...description,seed:7},engines[engine],{clock:()=>now});runner.play();
        for(let i=0;i<120;i++){now+=50;runner.step(now);}
        runner.pause();const frozen=structuredClone(runner.game.state);
        now+=5000;runner.step(now);runner.game.input({action:engine==='dock'?'left_left':'left'});
        assert.deepEqual(runner.game.state,frozen,`${engine}: paused play ignores time and input`);
        runner.play();now+=50;runner.step(now);assert.ok(runner.game.state.time>frozen.time);
        runner.restart();assert.equal(runner.game.state.time,0);assert.equal(runner.game.state.score,0);assert.equal(runner.phase,'playing');
        runner.dispose();
    }
});
