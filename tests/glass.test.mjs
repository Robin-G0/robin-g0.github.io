import test from 'node:test';
import assert from 'node:assert/strict';
import {prisms,PRISMS,wrap,orientationFor,forbidden,crystalCount,parMoves,makeSet} from '../arcade/games/glass/prisms.js';
import {abyss,ABYSS,riseSpeed,waveInterval,stageAt as abyssStage,multiplier,makeWave} from '../arcade/games/glass/abyss.js';
import {orbit,ORBIT,angleGap,stageAt as orbitStage,beaconLife,debrisInterval} from '../arcade/games/glass/orbit.js';
import * as theme from '../arcade/games/glass.js';
import * as tutorials from '../arcade/games/glass/tutorials.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';
import {Painter} from '../arcade/core/painter.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const g=factory({pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra});
    g.start();return {g,s:g.state,sounds,results,advance(seconds){
        for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));
    }};
}
function painter(compact=false,h=420) {
    const gradient={addColorStop(){}};
    const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,measureText:()=>({width:120})},{get(t,k){return k in t?t[k]:()=>{};}});
    const p=new Painter(context,{bg:'#fff',ink:'#123',accent:'#456',muted:'#789',border:'#abc',soft:'#def',gold:'#d90',font:'Arial'});
    p.compact=compact;p.h=h;return p;
}
/** Runs a policy through the host runner with at least `gap` seconds between inputs. */
function runPolicy(engine,policy,{seconds=180,gap=1,seed=7,difficulty='gentle'}={}) {
    const description={...games.find(g=>g.engine===engine),seed,difficulty};
    let now=0;const runner=new GameRunner(description,engines[engine],{clock:()=>now});
    runner.play();let last=-10,inputs=0;
    while(runner.phase==='playing'&&runner.elapsed<seconds){
        now+=50;runner.step(now);
        if(runner.phase!=='playing')break;
        if(runner.elapsed-last>=gap){const action=policy(runner.game.state);if(action){runner.game.input({action});last=runner.elapsed;inputs++;}}
    }
    return {runner,state:runner.game.state,inputs};
}

// ---------------- Prisms ----------------

test('Prisms: L/R turn the fan one spoke, the ray of a crystal\'s colour lights it, several at once score n²',()=>{
    const {g,s,sounds}=setup(prisms);
    s.rotation=0;s.crystals=[{spoke:2,colour:1,lit:false},{spoke:3,colour:2,lit:false},{spoke:6,colour:0,lit:false}];s.shard=null;s.par=parMoves(0,s.crystals);
    assert.deepEqual(s.crystals.map(orientationFor),[1,1,6]);assert.equal(s.par,4,'One step right lights two, then three steps left reach 6');
    g.input({action:'right'});
    assert.equal(s.rotation,1);assert.equal(s.score,PRISMS.crystalPoints*4,'Two crystals in one turn score 10 × 2²');
    assert.ok(s.bursts.some(b=>b.text==='DOUBLE +40'));assert.ok(sounds.some(e=>e.kind==='turn'));
    g.input({action:'right'});g.input({action:'left'});g.input({action:'left'});g.input({action:'left'});
    assert.equal(s.rotation,7);assert.equal(s.score,40,'Wrong colours light nothing and cost nothing');
    g.input({action:'left'});
    assert.equal(s.rotation,6);assert.equal(s.solved,true);
    assert.equal(s.score,40+10+PRISMS.setPoints,'Six turns against a par of four: set bonus without PERFECT');
    assert.equal(s.sets,1);g.input({action:'left'});assert.equal(s.rotation,6,'Turns are ignored while the cleared set rests');
    g.update(PRISMS.rest+.01);assert.equal(s.solved,false);assert.equal(s.moves,0);assert.equal(s.crystals.length,crystalCount(1));
});

test('Prisms: a set solved in par turns earns PERFECT, and dark glass cracks for an attempt when any ray touches it',()=>{
    const {g,s,sounds,results}=setup(prisms);
    s.rotation=0;s.crystals=[{spoke:3,colour:1,lit:false}];s.shard=null;s.par=2;
    g.input({action:'right'});g.input({action:'right'});
    assert.equal(s.score,10+PRISMS.setPoints+PRISMS.perfectPoints);assert.ok(sounds.some(e=>e.kind==='powerup'));
    g.update(PRISMS.rest+.01);
    s.rotation=0;s.shard=4;s.crystals=[{spoke:7,colour:0,lit:false}];
    assert.deepEqual(forbidden(4),[4,3,2]);
    g.input({action:'right'});assert.equal(s.lives,3,'Rays on 1, 2 and 3 do not touch spoke 4');
    g.input({action:'right'});
    assert.equal(s.lives,2);assert.equal(s.shard,null,'The shard shatters once');assert.ok(sounds.some(e=>e.kind==='miss'));
    assert.equal(parMoves(0,[{spoke:6,colour:0}],4),2,'Blocked arcs force the long way round');
    assert.equal(parMoves(1,[{spoke:6,colour:0}],4),3);
    assert.deepEqual(results,[]);
});

test('Prisms sets grow from two to four crystals, add dark glass from set 4, and are always solvable around it',()=>{
    assert.deepEqual([0,1,2,4,5,9].map(crystalCount),[2,2,3,3,4,4]);
    const random=seededRandom(9);
    for(let sets=0;sets<12;sets++)for(let rotation=0;rotation<8;rotation++){
        const set=makeSet(random,rotation,sets);
        assert.equal(set.crystals.length,crystalCount(sets));
        assert.equal(set.shard!=null,sets>=PRISMS.shardFrom);
        assert.equal(new Set(set.crystals.map(c=>c.spoke)).size,set.crystals.length,'One crystal per spoke');
        assert.ok(!set.crystals.some(c=>c.spoke===set.shard));
        assert.ok(!set.crystals.some(c=>orientationFor(c)===rotation),'Nothing is lit for free');
        assert.ok(set.par>=1&&Number.isFinite(set.par));
        assert.ok(!forbidden(set.shard).includes(rotation));
    }
    assert.deepEqual([wrap(-1),wrap(9)],[7,1]);
});

test('Prisms: a planning player with 1 s between turns keeps clearing sets; an idle run times out through the host clock',()=>{
    const plan=s=>{
        if(s.solved)return null;
        const need=s.crystals.filter(c=>!c.lit);let best=null;
        for(const [action,step] of [['left',-1],['right',1]]){
            const r=wrap(s.rotation+step);if(forbidden(s.shard).includes(r))continue;
            const p=parMoves(r,need,s.shard);if(!best||p<best.p)best={action,p};
        }
        return best?.action;
    };
    const {runner,state}=runPolicy('prisms',plan,{seconds:240});
    assert.equal(runner.phase,'playing',`Still playing at ${runner.elapsed.toFixed(0)} s`);
    assert.ok(state.sets>=25,`cleared ${state.sets} sets`);assert.equal(state.lives,3,'The planner never touches dark glass');
    const idle=runPolicy('prisms',()=>null,{seconds:400});
    assert.equal(idle.runner.phase,'finished');assert.equal(idle.runner.resultText,'Time up');
    assert.ok(idle.runner.elapsed>60&&idle.runner.elapsed<160,`idle lasted ${idle.runner.elapsed}`);
});

// ---------------- Abyss Drift ----------------

test('Abyss: sweeps swim one lane in screen direction, walls are harmless, a raise pulses and catches motes in reach',()=>{
    const {g,s,sounds}=setup(abyss);
    assert.equal(s.lane,ABYSS.start);
    g.input({action:'left_left'});assert.equal(s.lane,0);
    g.input({action:'right_left'});assert.equal(s.lane,0,'The wall is harmless');assert.equal(s.lives,3);
    g.input({action:'right_right'});g.input({action:'left_right'});assert.equal(s.lane,2,'Either wrist can sweep either way');
    s.objects=[{kind:'mote',lane:2,depth:.4,deep:false,id:1,done:false},{kind:'mote',lane:2,depth:.5,deep:false,id:2,done:false},
        {kind:'mote',lane:3,depth:0,deep:false,id:3,done:false},{kind:'mote',lane:2,depth:.9,deep:false,id:4,done:false}];
    const glow=s.glow;g.input({action:'left_up'});
    assert.equal(s.score,20,'Both motes in reach and lane are caught; the far one and the other lane are not');
    assert.equal(s.chain,2);assert.ok(s.bursts.some(b=>b.text==='PAIR +20'));
    assert.equal(s.glow,Math.min(ABYSS.glow,glow-ABYSS.pulseCost+2*ABYSS.moteGlow));
    assert.ok(sounds.some(e=>e.kind==='powerup'));
    const before=s.glow;g.input({action:'right_up'});assert.equal(s.glow,before-ABYSS.pulseCost,'An empty pulse spends a little glow');assert.equal(s.score,20);
});

test('Abyss: chains raise the multiplier, violet motes pay x3, missed motes break the chain, reefs and darkness cost lives',()=>{
    assert.deepEqual([0,3,4,8,12,40].map(multiplier),[1,1,2,3,4,4]);
    const {g,s,sounds,results}=setup(abyss);
    s.nextWave=1e9;s.chain=3;
    s.objects=[{kind:'mote',lane:1,depth:0,deep:true,id:1,done:false}];
    g.input({action:'left_up'});assert.equal(s.score,ABYSS.points*2*ABYSS.deepFactor,'Fourth in a chain (x2), violet (x3)');
    s.objects=[{kind:'mote',lane:1,depth:-.5,deep:false,id:2,done:false}];g.update(.1);assert.equal(s.chain,0,'A mote that passes breaks the chain');
    s.objects=[{kind:'reef',lanes:[1,2],depth:.2,id:3,done:false}];g.update(.05);
    assert.equal(s.lives,2);assert.ok(sounds.some(e=>e.kind==='miss'));
    s.objects=[{kind:'reef',lanes:[1],depth:.2,id:4,done:false}];g.update(.05);assert.equal(s.lives,2,'Recovery after a hit');
    g.update(ABYSS.recovery);s.glow=.01;g.update(.05);assert.equal(s.lives,1);assert.equal(s.glow,ABYSS.refill,'Running out of light costs a life and refills');
    s.objects=[{kind:'current',dir:1,depth:.01,id:5,done:false}];g.update(.05);assert.equal(s.lane,2,'A current pushes one lane');
    assert.deepEqual(results,[]);
});

test('Abyss stages add wide reefs, violet motes and currents; every reef leaves a reachable open lane',()=>{
    assert.deepEqual([0,39.9,40,80,130].map(abyssStage),[0,0,1,2,3]);
    assert.equal(riseSpeed(1),ABYSS.rise);assert.equal(riseSpeed(5),ABYSS.maxRise);
    assert.equal(waveInterval(1),ABYSS.interval);assert.equal(waveInterval(5),ABYSS.minInterval);
    for(let stage=0;stage<4;stage++){
        const random=seededRandom(stage+1),kinds=new Set();let open=[0,1,2,3];
        for(let i=0;i<400;i++){
            const wave=makeWave(random,stage,open,waveInterval(1.6));
            for(const o of wave.objects){kinds.add(o.kind+(o.deep?'-deep':'')+(o.lanes?.length===2?'-wide':''));}
            const reef=wave.objects.find(o=>o.kind==='reef');
            if(reef){assert.ok(reef.lanes.length<=(stage>=1?2:1));assert.ok(wave.open.length>0);
                assert.ok(wave.open.every(l=>!reef.lanes.includes(l)&&open.some(o=>Math.abs(o-l)<=1)));open=wave.open;}
        }
        assert.equal(kinds.has('reef-wide'),stage>=1);assert.equal(kinds.has('mote-deep'),stage>=2);assert.equal(kinds.has('current'),stage>=3);
    }
});

test('Abyss: a player with 1 s between moves survives and scores for minutes; idle play runs out of light and loses',()=>{
    const play=s=>{
        const ahead=s.objects.filter(o=>!o.done&&o.depth>-.3);
        const danger=lane=>ahead.some(o=>o.kind==='reef'&&o.lanes.includes(lane)&&o.depth<2.2);
        if(danger(s.lane)){
            for(const d of [-1,1,-2,2]){const l=s.lane+Math.sign(d);if(l>=0&&l<4&&!danger(l))return Math.sign(d)<0?'left_left':'right_right';}
        }
        if(ahead.some(o=>o.kind==='mote'&&o.lane===s.lane&&Math.abs(o.depth)<=ABYSS.catchReach-.05))return 'left_up';
        const target=ahead.filter(o=>o.kind==='mote'&&o.depth>.3).sort((a,b)=>a.depth-b.depth)[0];
        if(target&&target.lane!==s.lane){const l=s.lane+Math.sign(target.lane-s.lane);if(!danger(l))return target.lane<s.lane?'right_left':'left_right';}
        return null;
    };
    for(const seed of [3,7,11]){
        const {runner,state}=runPolicy('abyss',play,{seconds:200,seed});
        assert.equal(runner.phase,'playing',`seed ${seed}: lost at ${runner.elapsed.toFixed(0)} s`);
        assert.ok(state.caught>=45,`seed ${seed}: caught ${state.caught}`);assert.ok(state.stage===3);
    }
    const idle=runPolicy('abyss',()=>null,{seconds:600});
    assert.equal(idle.runner.phase,'finished');assert.equal(idle.runner.resultText,'Game over');assert.ok(idle.runner.elapsed<120);
});

// ---------------- Orbital Assist ----------------

test('Orbit: L drops to the faster inner ring, R climbs; transfers take .45 s, a raise mid-transfer flies on arrival',()=>{
    const {g,s,sounds}=setup(orbit);
    assert.equal(s.ring,ORBIT.start);s.beacons=[];s.nextBeacon=1e9;
    g.input({action:'left'});assert.ok(s.transfer);assert.equal(s.ring,1);assert.ok(sounds.some(e=>e.kind==='thrust'));
    g.input({action:'right'});assert.equal(s.queued,1);
    g.update(ORBIT.transfer+.01);assert.equal(s.ring,0);assert.ok(s.transfer,'The queued climb starts at once');assert.equal(s.queued,0);
    g.update(ORBIT.transfer+.01);assert.equal(s.ring,1);assert.equal(s.transfer,null);
    g.input({action:'right'});g.update(.5);g.input({action:'right'});g.update(.5);assert.equal(s.ring,3);
    g.input({action:'right'});assert.equal(s.transfer,null,'The outermost ring is a harmless bump');assert.equal(s.lives,3);
    assert.ok(ORBIT.speeds.every((v,i,a)=>!i||v<a[i-1]),'Inner rings are faster');
});

test('Orbit: arriving next to a beacon collects it, chains to x4, gold pays x3; a fading beacon breaks the chain; debris costs a life',()=>{
    const {g,s,sounds,results,advance}=setup(orbit);
    s.nextBeacon=1e9;s.nextDebris=1e9;
    s.angle=0;s.beacons=[{ring:2,angle:.1,born:0,life:15,gold:false,id:1}];
    g.input({action:'right'});g.update(ORBIT.transfer+.01);
    assert.equal(s.score,ORBIT.points);assert.equal(s.chain,1);assert.equal(s.beacons.length,0);assert.ok(sounds.some(e=>e.kind==='clear'));
    s.beacons=[{ring:1,angle:s.angle+.05,born:s.time,life:15,gold:true,id:2}];
    g.input({action:'left'});g.update(ORBIT.transfer+.01);
    assert.equal(s.score,ORBIT.points+ORBIT.points*2*ORBIT.goldFactor,'Second in the chain, gold');
    s.beacons=[{ring:3,angle:2,born:s.time,life:1,gold:false,id:3}];g.update(1.05);assert.equal(s.chain,0,'Faded');
    s.beacons=[{ring:2,angle:s.angle+1.5,born:s.time,life:15,gold:false,id:4}];
    g.input({action:'right'});g.update(ORBIT.transfer+.01);assert.equal(s.chain,0,'Arriving far from the beacon collects nothing');
    s.debris=[{ring:2,angle:s.angle+ORBIT.speeds[2]*ORBIT.debrisWarning+.05,born:s.time,travelled:0,id:5}];g.update(.1);assert.equal(s.lives,3,'Debris is only a warning at first');
    advance(ORBIT.debrisWarning);assert.equal(s.lives,2);assert.ok(sounds.some(e=>e.kind==='miss'));
    assert.deepEqual(results,[]);
    assert.ok(Math.abs(angleGap(.1,2*Math.PI-.1)-.2)<1e-9);
});

test('Orbit stages: beacons only, debris from 30 s, gold relays and two beacons from 75 s, dense debris from 120 s',()=>{
    assert.deepEqual([0,29.9,30,75,120].map(orbitStage),[0,0,1,2,3]);
    assert.equal(beaconLife(1),ORBIT.beaconLife);assert.equal(beaconLife(9),ORBIT.minBeaconLife);
    assert.equal(debrisInterval(1,1),ORBIT.debrisInterval);assert.equal(debrisInterval(3,1),ORBIT.denseInterval);assert.equal(debrisInterval(3,9),ORBIT.minDebrisInterval);
    const {s,advance}=setup(orbit);
    advance(29);assert.equal(s.debris.length,0);assert.equal(s.lives,3,'Nothing can hurt during the first stage');assert.ok(s.beacons.length<=1);
    let golds=0,most=0;
    for(let t=0;t<150&&!s.ended;t++){advance(1);most=Math.max(most,s.beacons.length);if(s.beacons.some(b=>b.gold))golds++;s.invulnerableUntil=1e9;}
    assert.equal(most,2);assert.ok(golds>0);assert.ok(s.debris.length<=ORBIT.maxDebris);
});

test('Orbit: a phasing player with 1 s between burns keeps collecting and dodging; idle play is hit by debris and loses',()=>{
    const settled=s=>s.transfer?null:s.ring;
    const play=s=>{
        const ring=settled(s);if(ring==null)return null;
        const threat=r=>s.debris.some(d=>d.ring===r&&(()=>{const gap=angleGap(d.angle,s.angle);return gap>-.2&&gap<2.2;})());
        if(threat(ring)){const options=[ring-1,ring+1].filter(r=>r>=0&&r<4&&!threat(r));if(options.length)return options[0]<ring?'left':'right';}
        const beacon=[...s.beacons].sort((a,b)=>Math.abs(a.ring-ring)-Math.abs(b.ring-ring))[0];if(!beacon)return null;
        if(Math.abs(beacon.ring-ring)===1){
            const next=beacon.ring,t=ORBIT.transfer,mine=s.angle+(ORBIT.speeds[ring]+ORBIT.speeds[next])/2*t,theirs=beacon.angle+ORBIT.speeds[next]*t;
            if(Math.abs(angleGap(theirs,mine))<ORBIT.capture*.7&&!threat(next))return next<ring?'left':'right';
            return null;
        }
        // Same ring: hop to a neighbour to change phase. Farther: approach it.
        const step=beacon.ring===ring?(ring>0?-1:1):Math.sign(beacon.ring-ring),next=ring+step;
        return threat(next)?null:step<0?'left':'right';
    };
    for(const seed of [2,5,9]){
        const {runner,state,inputs}=runPolicy('orbit',play,{seconds:200,seed});
        assert.equal(runner.phase,'playing',`seed ${seed}: lost at ${runner.elapsed.toFixed(0)} s`);
        assert.ok(state.collected>=12,`seed ${seed}: collected ${state.collected} with ${inputs} burns`);
    }
    const idle=runPolicy('orbit',()=>null,{seconds:600});
    assert.equal(idle.runner.phase,'finished');assert.equal(idle.runner.resultText,'Game over');assert.ok(idle.runner.elapsed<160,`idle lasted ${idle.runner.elapsed}`);
});

// ---------------- Shared contracts ----------------

for(const [engine,factory,actions] of [['prisms',prisms,['left','right']],['abyss',abyss,['left_left','left_up','right_right','right_up']],['orbit',orbit,['left','right']]]){
    test(`${engine}: reduced motion changes nothing, pause freezes, restart is fresh, arrays stay bounded and rendering works in both layouts`,()=>{
        const a=setup(factory),b=setup(factory,{reducedMotion:true});
        for(let i=0;i<9000&&!a.results.length;i++){
            if(i%70===0){const action=actions[(i/70)%actions.length];a.g.input({action});b.g.input({action});}
            a.g.update(.02);b.g.update(.02);
            if(i%400===0){a.g.render(painter(false));b.g.render(painter(true,1500));}
            assert.ok(a.s.bursts.length<=6&&a.s.effects.length<=16);
            if(engine==='abyss')assert.ok(a.s.objects.length<=ABYSS.maxObjects);
            if(engine==='orbit')assert.ok(a.s.debris.length<=ORBIT.maxDebris&&a.s.beacons.length<=2);
            if(engine==='prisms')assert.ok(a.s.crystals.length<=4);
        }
        assert.deepEqual(a.s,b.s);
        a.g.pause();const frozen=structuredClone(a.s);a.g.input({action:actions[0]});a.g.update(5);assert.deepEqual(a.s,frozen);
        a.g.resume();
        const fresh=setup(factory);assert.equal(fresh.s.score,0);assert.equal(fresh.s.time,0);
    });
}

test('Glass engines use the illustrated host policy, declared clocks, precision hints, lessons, cards and isolated versioned scores',()=>{
    assert.deepEqual(Object.keys(theme).sort(),['abyss','orbit','prisms']);
    for(const [engine,version,precision,profile] of [['prisms',2,'low','wrist-up-only'],['abyss',2,'full','popup-directions'],['orbit',2,'low','wrist-up-only']]){
        const description=games.find(game=>game.engine===engine),config=gameConfig(description);
        assert.equal(config.profileFile,profile);assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(description.scoreVersion,version);assert.equal(description.precision,precision);
        assert.equal(tutorials.diagrams[engine].length,3);assert.equal(tutorials.captions[engine].length,3);assert.equal(tutorials.lessons[engine].length,3);
        for(const svg of tutorials.diagrams[engine])assert.match(svg,/^<svg[^>]*class="guide-art glass-diagram"/);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        const link=challengeLink('https://example.com/',description,{name:'GLASS',score:100});
        assert.equal(readChallenge(link,games).rules,version);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'GLASS',score:999}),games),null);
    }
    assert.deepEqual(Object.keys(games.find(g=>g.engine==='abyss').controls).sort(),['left_left','left_right','left_up','right_left','right_right','right_up']);
    assert.equal(PRESSURE_RULES.prisms.kind,'rounds');assert.equal(PRESSURE_RULES.prisms.seconds,32);
    assert.equal(PRESSURE_RULES.abyss.kind,'survival');assert.equal(PRESSURE_RULES.orbit.kind,'survival');
    assert.deepEqual(['prisms','abyss','orbit'].map(livesLabel),['Attempts','Lives','Lives']);
});
