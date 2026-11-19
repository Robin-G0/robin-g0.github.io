import test from 'node:test';
import assert from 'node:assert/strict';
import {memory,TILES,tileCadence,revealedSteps} from '../arcade/games/metro/tiles.js';
import {merge,MERGE,collapse,slide,blocked} from '../arcade/games/metro/merge.js';
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
    assert.ok(sounds.some(e=>e.kind==='powerup'));
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

test('Tile Merge slides merge each pair once, count merges, and reject moves that change nothing',()=>{
    assert.deepEqual(collapse([2,2,2,2,0,0,0]),{row:[4,4,0,0,0,0,0],points:8});
    assert.deepEqual(slide([2,2,4,0,0,0,0],'left'),{row:[4,4,0,0,0,0,0],points:4,merges:1,moved:true});
    assert.deepEqual(slide([0,0,0,0,4,2,2],'right').row,[0,0,0,0,0,4,4]);
    assert.equal(slide([4,2,0,0,0,0,0],'left').moved,false);
    assert.equal(blocked([2,4,2,4,2,4,2]),true);assert.equal(blocked([2,4,4,2,8,2,4]),false);assert.equal(blocked([2,4,2,4,2,4,0]),false);
});

test('Tile Merge previews a balanced bag, spawns opposite the slide, doubles double merges and resets a blocked row for a heart',()=>{
    const {g,s,sounds}=setup(merge);
    assert.equal(s.row.length,MERGE.cells);
    s.row=[2,2,4,4,0,0,0];s.next=2;s.bag=[4];
    g.input({action:'left'});
    assert.deepEqual(s.row,[4,8,0,0,0,0,2]);assert.equal(s.score,24,'(4 + 8) × 2 merges');assert.equal(s.next,4);assert.equal(s.best,8);
    g.input({action:'left'});
    assert.deepEqual(s.row,[4,8,2,0,0,0,4]);assert.equal(s.score,24);assert.equal(s.bag.length,MERGE.bag.length-1,'An empty bag refills with a shuffled copy');
    s.row=[4,8,2,0,0,0,0];const next=s.next;
    g.input({action:'left'});
    assert.equal(s.lastMove.moved,false);assert.deepEqual(s.row,[4,8,2,0,0,0,0]);assert.equal(s.next,next,'A slide that moves nothing spawns nothing');
    s.bag=[];const values=[];
    for(let i=0;i<MERGE.bag.length;i++){s.row=[2,0,0,0,0,0,0];g.input({action:'right'});values.push(s.next);}
    assert.equal(values.filter(value=>value===4).length,MERGE.bag.filter(value=>value===4).length,'Every bag holds exactly its share of 4s');
    s.row=[2,4,2,4,2,4,0];s.next=8;
    g.input({action:'right'});
    assert.equal(s.lives,2);assert.deepEqual(s.row,[8,0,0,0,0,0,0]);assert.equal(s.resets,1);assert.ok(sounds.some(e=>e.kind==='miss'));
});

test('Tile Merge rewards planning: a greedy preview player outlasts chance, and a stalling player avoids blocks but barely scores',()=>{
    const after=(row,direction,value)=>{const r=slide(row,direction);if(!r.moved)return null;const next=[...r.row];next[direction==='left'?next.length-1:0]=value;return {row:next,points:r.points*r.merges};};
    const greedy=s=>['left','right'].map(d=>{const a=after(s.row,d,s.next);return {d,v:a?a.points-(blocked(a.row)?1000:0):-9};}).sort((a,b)=>b.v-a.v)[0].d;
    const stall=s=>s.moves%2?'left':'right';
    const play=(policy,seed,limit)=>{
        const results=[];const g=merge({pace:1,random:seededRandom(seed),message(){},sound(){},finish:t=>results.push(t)});g.start();
        let moves=0;for(;moves<limit&&!results.length;moves++){g.input({action:policy(g.state)});g.update(.05);}
        return {moves,best:g.state.best,score:g.state.score,over:results.length>0};
    };
    for(let seed=1;seed<=6;seed++){
        const smart=play(greedy,seed,600);
        assert.ok(smart.moves>=30&&smart.best>=16,`seed ${seed}: ${smart.moves} moves, best ${smart.best}`);
    }
    const stalled=play(stall,1,300),scored=play(greedy,1,300);
    assert.equal(stalled.over,false,'Alternating slides keep the row open; the round clock is what punishes stalling');
    assert.ok(stalled.score<scored.score/2);
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

test('Metro engines use the shared illustrated host policy, declared clocks, and isolated v2 scores',()=>{
    for(const engine of ['memory','merge','rail']){
        const description=games.find(game=>game.engine===engine),config=gameConfig(description);
        assert.equal(config.profileFile,'wrist-up-only');assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(description.scoreVersion,2);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        const link=challengeLink('https://example.com/',description,{name:'METRO',score:100});
        assert.equal(readChallenge(link,games).rules,2);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'METRO',score:999}),games),null);
    }
    assert.equal(PRESSURE_RULES.rail.kind,'survival');
    assert.deepEqual([PRESSURE_RULES.memory.seconds,PRESSURE_RULES.merge.seconds],[24,20]);
});
