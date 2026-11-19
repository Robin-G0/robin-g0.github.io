import test from 'node:test';
import assert from 'node:assert/strict';
import {memory,TILES,tileCadence,revealedSteps} from '../arcade/games/metro/tiles.js';
import {merge,DROP,landTile,spawnRange,varietyAfter,retireBelow,label} from '../arcade/games/metro/drop.js';
import {rail,RAIL,arrivalInterval,travelSeconds} from '../arcade/games/metro/rail.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig} from '../arcade/core/game-config.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const g=factory({pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra});
    g.start();return {g,s:g.state,sounds,results,advance(seconds){
        for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));
    }};
}

test('Live Tiles answers only revealed steps live, ignores the rest harmlessly and doubles an all-live finish',()=>{
    const {g,s,advance,sounds}=setup(memory);
    s.sequence=['left','right'];
    g.input({action:'left'});
    assert.equal(s.score,0);assert.equal(s.lastInput.ignored,true,'Nothing is revealed before the show starts');
    advance(1);assert.equal(revealedSteps(s),1);
    g.input({action:'left'});assert.equal(s.score,TILES.livePoints);assert.equal(s.index,1);
    g.input({action:'right'});assert.equal(s.score,TILES.livePoints);assert.equal(s.lives,3,'An unrevealed step is neither right nor wrong');
    advance(1.1);assert.equal(revealedSteps(s),2);
    g.input({action:'right'});
    assert.equal(s.score,80,'20 + 20 live, then 10 per tile doubled for an all-live finish');
    assert.equal(s.rounds,1);assert.equal(s.sequence.length,3);assert.equal(s.phase,'show');
    assert.ok(sounds.some(e=>e.kind==='powerup'));assert.ok(s.bursts.some(b=>b.text.startsWith('+1 TILE')));
});

test('Live Tiles repeats after the show for single points; a wrong tile costs a heart and replays the same order',()=>{
    const {g,s,advance,sounds}=setup(memory);
    s.sequence=['left','left','right'];
    advance(4.4);assert.equal(s.phase,'repeat');
    g.input({action:'left'});assert.equal(s.score,TILES.stepPoints);
    g.input({action:'right'});
    assert.equal(s.lives,2);assert.equal(s.phase,'show');assert.equal(s.index,0);
    assert.deepEqual(s.sequence,['left','left','right']);assert.ok(sounds.some(e=>e.kind==='miss'));
    advance(TILES.retry+3*s.cadence+.2);assert.equal(s.phase,'repeat');
    for(const action of ['left','left','right'])g.input({action});
    assert.equal(s.score,70,'10 earlier, 30 for the repeat and a 30 finish bonus without the live double');
    assert.equal(s.rounds,1);assert.equal(s.sequence.length,4);
    assert.equal(tileCadence(0),TILES.maxCadence);assert.equal(tileCadence(40),TILES.minCadence);
});

test('an idle Live Tiles run loses through the host round clock, which pauses while tiles are shown',()=>{
    const description=games.find(game=>game.id==='metro-memory');
    let now=0;const runner=new GameRunner({...description,seed:3},engines.memory,{clock:()=>now});
    runner.play();
    while(runner.phase==='playing'&&now<400000){now+=100;runner.step(now);}
    assert.equal(runner.phase,'finished');assert.equal(runner.resultText,'Time up');
    assert.ok(runner.elapsed>60&&runner.elapsed<200,`Three shrinking rounds plus show phases, not instant: ${runner.elapsed}`);
});

test('Tile Drop landings merge below and sideways in chains, overflow full columns, retire small tiles and label big ones',()=>{
    let columns=[[2],[],[],[],[]];
    assert.deepEqual(landTile(columns,0,2),{overflow:false,points:4,merges:1,value:4,row:0});assert.deepEqual(columns,[[4],[],[],[],[]]);
    columns=[[2],[],[2],[],[]];
    assert.equal(landTile(columns,1,2).value,8,'Two equal side neighbours quadruple');assert.deepEqual(columns,[[],[8],[],[],[]]);
    columns=[[4],[2],[],[],[]];
    const chain=landTile(columns,1,2);
    assert.deepEqual([chain.value,chain.merges,chain.points],[8,2,4+8*2],'Below first, then the freed side neighbour, scored by chain step');
    assert.deepEqual(columns,[[],[8],[],[],[]]);
    columns=[[2,4,8,16,32,64],[],[],[],[]];
    assert.equal(landTile(columns,0,2).overflow,true);assert.equal(columns[0].length,DROP.rows);
    columns=[[2,4],[8,2],[],[2],[16]];
    assert.equal(retireBelow(columns,4),3);assert.deepEqual(columns,[[4],[8],[],[],[16]]);
    assert.deepEqual(spawnRange(2),[2,4,8]);assert.deepEqual(spawnRange(8,5),[8,16,32,64,128]);
    assert.deepEqual([varietyAfter(0),varietyAfter(3),varietyAfter(10)],[3,4,5]);
    assert.deepEqual([label(512),label(2048),label(2**20),label(2**31)],['512','2k','1M','2G']);
});

test('Tile Drop moves on single raises with a capped .2 s refund, drops on a chord, respects edges and deadlines',()=>{
    const {g,s,advance,results}=setup(merge);
    assert.equal(s.column,2);assert.equal(s.lives,1,'One life');
    advance(.01);const deadline=s.deadline;
    g.input({action:'left'});assert.equal(s.column,2,'A single raise waits out the chord window');
    advance(.15);assert.equal(s.column,1);assert.ok(Math.abs(s.deadline-deadline-DROP.refund)<1e-9,'A real move refunds .2 s');
    g.input({action:'left'});g.input({action:'left'});advance(.15);assert.equal(s.column,0,'A duplicate raise is one move');
    g.input({action:'left'});advance(.15);assert.equal(s.column,0);assert.equal(s.lastMove.moved,false,'The edge is harmless');
    assert.ok(Math.abs(s.deadline-deadline-2*DROP.refund)<1e-9,'Edges refund nothing');
    for(let i=0;i<3;i++){g.input({action:'right'});advance(.15);}
    assert.equal(s.column,3);assert.ok(Math.abs(s.deadline-deadline-(DROP.columns-1)*DROP.refund)<1e-9,'Refunds stop after four moves per tile');
    const value=s.value,next=s.next;
    g.input({action:'left'});g.input({action:'right'});
    assert.deepEqual(s.columns[3],[value]);assert.equal(s.drops,1);assert.equal(s.value,next,'Both raises together drop at once and the preview advances');
    assert.equal(s.pending,null);assert.equal(s.column,3,'A chord does not also move');assert.equal(s.refunds,0,'The next tile starts with a fresh refund allowance');
    assert.equal(s.budget,DROP.budget);assert.ok(Math.abs(s.deadline-s.time-DROP.budget)<1e-9);
    const before=s.drops;advance(DROP.budget+.05);assert.equal(s.drops,before+1,'The deadline drops the tile by itself');
    s.columns=[[128],[],[],[2],[2,8]];s.column=0;s.value=128;s.best=128;
    g.input({action:'left'});g.input({action:'right'});
    assert.equal(s.floor,4);assert.equal(s.retirements,1);assert.deepEqual(s.columns,[[256],[],[],[],[8]],'Reaching 128 times the floor retires every 2');
    assert.ok(s.value>=4&&s.next>=4);
    assert.deepEqual(results,[]);
});

test('Tile Drop ends the run on the first full column',()=>{
    const {g,s,sounds,results}=setup(merge);
    s.columns[2]=[2,4,8,16,32,64];
    g.input({action:'left'});g.input({action:'right'});
    assert.deepEqual(results,['Game over']);assert.equal(s.lives,0);assert.equal(s.ended,true);assert.ok(sounds.some(e=>e.kind==='miss'));
    const drops=s.drops;g.input({action:'left'});g.input({action:'right'});g.update(10);
    assert.equal(s.drops,drops,'Nothing moves after the end');
});

test('Tile Drop rewards column choice: random drops lose soon, a greedy player lasts hundreds of drops and keeps retiring',()=>{
    const clone=columns=>columns.map(stack=>[...stack]);
    const evaluate=(columns,column,value)=>{const c=clone(columns);const r=landTile(c,column,value);if(r.overflow)return -1e6;
        const heights=c.map(stack=>stack.length);return r.points-Math.max(...heights)**2*3-heights.reduce((a,h)=>a+h,0);};
    const policies={
        random:(s,rnd)=>Math.floor(rnd()*DROP.columns),
        greedy:s=>{let best=-Infinity,choice=0;for(let c=0;c<DROP.columns;c++){const v=evaluate(s.columns,c,s.value);if(v>best){best=v;choice=c;}}return choice;}
    };
    const play=(name,seed,cap)=>{
        const rnd=seededRandom(seed+1000),results=[];
        const g=merge({pace:1,random:seededRandom(seed),message(){},sound(){},finish:t=>results.push(t)});g.start();const s=g.state;
        let drops=0;
        while(drops<cap&&!results.length){
            const target=policies[name](s,rnd);
            while(s.column!==target&&!results.length){g.input({action:s.column<target?'right':'left'});g.update(.15);}
            g.input({action:'left'});g.input({action:'right'});g.update(.05);drops++;
        }
        return {drops,over:results.length>0,retirements:s.retirements};
    };
    for(let seed=1;seed<=4;seed++){
        const chance=play('random',seed,400),skill=play('greedy',seed,900);
        assert.ok(chance.over&&chance.drops<200,`seed ${seed}: random lasted ${chance.drops}`);
        assert.ok(skill.drops>=900&&!skill.over,`seed ${seed}: greedy lasted only ${skill.drops}`);
        assert.ok(skill.retirements>=3,'The floor keeps rising instead of saturating the board');
    }
});

test('an unattended Tile Drop overflows into Game over and reduced motion changes nothing',()=>{
    const a=setup(merge),b=setup(merge,{reducedMotion:true});
    for(let i=0;i<30000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<600);assert.deepEqual(a.s,b.s);
});

test('Metro Line dispatches the front train, routes it by the junction at the fork, and pays convoys',()=>{
    const {g,s,advance,sounds}=setup(rail);
    assert.equal(arrivalInterval(1),RAIL.arrival);assert.equal(arrivalInterval(10),RAIL.minArrival);assert.equal(travelSeconds(1),RAIL.travel);
    g.input({action:'right'});assert.equal(s.trains.length,0,'An empty platform makes the raise harmless');
    advance(1.05);assert.equal(s.queue.length,1);
    const line=s.queue[0].line;
    g.input({action:'right'});assert.equal(s.trains.length,1);assert.equal(s.queue.length,0);
    if(s.junction===line)g.input({action:'left'});
    advance(2.7);
    assert.equal(s.lives,2);assert.equal(s.score,0);assert.equal(s.trains.length,0);assert.ok(sounds.some(e=>e.kind==='miss'));
    s.queue=[{line:1,id:11}];s.junction=0;s.nextArrival=1e9;
    g.input({action:'right'});advance(1);
    g.input({action:'left'});assert.equal(s.junction,1);
    advance(2);assert.equal(s.score,RAIL.points,'Switching before the fork routes the train');
    s.queue=[{line:1,id:12},{line:1,id:13}];
    g.input({action:'right'});g.input({action:'right'});
    assert.equal(s.trains.length,1,'A train still leaving the platform blocks the next dispatch harmlessly');
    advance(.6);g.input({action:'right'});assert.equal(s.trains.length,2);
    advance(3);
    assert.equal(s.score,RAIL.points*3+RAIL.convoy);assert.equal(s.served,3);assert.equal(s.convoy,1);
    assert.ok(sounds.some(e=>e.kind==='powerup'));
});

test('Metro Line cancels the oldest train on a full platform, loses when idle, and reduced motion changes nothing',()=>{
    const {g,s}=setup(rail);
    s.queue=[1,0,1,0].map((line,i)=>({line,id:i+1}));s.nextArrival=s.time;
    g.update(.01);
    assert.equal(s.queue.length,RAIL.capacity);assert.equal(s.queue[0].id,2);assert.equal(s.lives,2);
    const a=setup(rail),b=setup(rail,{reducedMotion:true});
    for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<60);assert.deepEqual(a.s,b.s);
});

test('Metro engines use the shared illustrated host policy, declared clocks, and isolated versioned scores',()=>{
    for(const [engine,version] of [['memory',2],['merge',3],['rail',2]]){
        const description=games.find(game=>game.engine===engine),config=gameConfig(description);
        assert.equal(config.profileFile,'wrist-up-only');assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(description.scoreVersion,version);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        const link=challengeLink('https://example.com/',description,{name:'METRO',score:100});
        assert.equal(readChallenge(link,games).rules,version);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'METRO',score:999}),games),null);
    }
    assert.equal(PRESSURE_RULES.rail.kind,'survival');assert.equal(PRESSURE_RULES.merge.kind,'survival');
    assert.equal(PRESSURE_RULES.memory.seconds,24);
});
