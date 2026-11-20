import test from 'node:test';
import assert from 'node:assert/strict';
import {memory,TILES,tileCadence,revealedSteps} from '../arcade/games/metro/tiles.js';
import {merge,DROP,landTile,settle,mergePoints,mergeText,spawnRange,varietyAfter,retireBelow,label} from '../arcade/games/metro/drop.js';
import {rail,RAIL,departureInterval,travelSeconds,stageAt,openStations,hasChild,destination} from '../arcade/games/metro/rail.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
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

test('Tile Drop landings join every equal neighbour, chain across the board, overflow full columns, retire small tiles and label big ones',()=>{
    let columns=[[2],[],[],[],[]];
    const first=landTile(columns,0,2);
    assert.deepEqual([first.overflow,first.points,first.merges,first.value,first.row],[false,20,1,4,0]);assert.deepEqual(columns,[[4],[],[],[],[]]);
    assert.deepEqual(first.events[0],{kind:'land',column:0,row:1,board:[[2,2],[],[],[],[]]},'The landing frame shows the tile before it merges');
    assert.deepEqual(first.events[1],{kind:'merge',column:0,row:0,value:4,step:1,joined:1,points:20,board:[[4],[],[],[],[]]},'Every frame carries the board it leaves, for the replay');
    assert.deepEqual([mergePoints(4,1),mergePoints(8,1),mergePoints(2**10,1),mergePoints(16,3)],[20,30,100,120],'Ten points per power of two, times the chain step');
    columns=[[2],[],[2],[],[]];
    const triple=landTile(columns,1,2);
    assert.deepEqual([triple.value,triple.merges,triple.points,triple.events[1].joined],[8,1,30,2],'Three tiles make x4 in one announced merge');assert.deepEqual(columns,[[],[8],[],[],[]]);
    assert.equal(mergeText(triple.events[1]),'TRIPLE ×4 +30');
    columns=[[4,2],[2],[4,2],[],[]]; // Landing on the 2 at row 1 touches both side 2s at that height.
    const quad=landTile(columns,1,2);
    assert.equal(quad.value,16,'Four tiles make x8');assert.deepEqual(columns,[[4],[16],[4],[],[]]);assert.equal(mergeText(quad.events[1]),'QUAD ×8 +40');
    columns=[[4],[2],[],[],[]];
    const chain=landTile(columns,1,2);
    assert.deepEqual([chain.value,chain.merges,chain.points],[8,2,20+30*2],'Below first, then the freed side neighbour, scored by chain step');
    assert.deepEqual(chain.events.map(mergeText),['','+20','CHAIN ×2 +60']);
    assert.deepEqual(columns,[[],[8],[],[],[]]);
    columns=[[2,4,8,16,32,64],[],[],[],[]];
    assert.equal(landTile(columns,0,2).overflow,true);assert.equal(columns[0].length,DROP.rows);
    // Cascade: absorbing the left neighbour drops its 8 next to another 8, which merges as a second chain step.
    columns=[[8],[2,8],[],[],[]];
    const cascade=landTile(columns,2,2);
    assert.deepEqual(columns,[[16],[],[4],[],[]]);assert.equal(cascade.merges,2);assert.equal(cascade.points,20+40*2);
    assert.deepEqual(cascade.events.filter(e=>e.kind==='merge').map(e=>[e.column,e.row,e.value,e.step]),[[2,0,4,1],[0,0,16,2]]);
    // Value only grows by the stated rule, x2 per joined neighbour, and a landing never touches tiles that were stable.
    columns=[[2],[],[4],[],[4]];
    assert.deepEqual(landTile(columns,0,2).events.map(e=>e.kind),['land','merge']);
    assert.deepEqual(columns,[[4],[],[4],[],[4]],'Tiles the landing never touches stay as they are');
    // A retirement that leaves equal tiles touching settles them at once, as later chain steps, instead of handing a free chain to the next landing.
    columns=[[2,4],[4],[],[],[128]]; // Stable now; retiring the 2 lands the 4 beside the other 4.
    const retire=landTile(columns,4,128,2);
    assert.deepEqual([retire.floor,retire.retirements,retire.retired],[4,1,1]);assert.deepEqual(columns,[[8],[],[],[],[256]]);
    assert.deepEqual(retire.events.map(e=>e.kind),['land','merge','retire','merge']);
    const cleared=retire.events[2];
    assert.deepEqual([cleared.floor,cleared.removed,cleared.before,cleared.board],[4,[{column:0,row:0,value:2}],[[2,4],[4],[],[],[256]],[[4],[4],[],[],[256]]],'The clear-out frame knows what vanishes and the boards before and after');
    assert.deepEqual(retire.events.filter(e=>e.kind==='merge').map(e=>[e.column,e.row,e.value,e.step,e.points]),[[4,0,256,1,80],[0,0,8,2,60]]);
    assert.deepEqual(settle([[4],[4],[],[],[2]]).map(e=>[e.column,e.row,e.value,e.step,e.points]),[[0,0,8,1,30]],'settle merges lowest and leftmost first');
    assert.equal(landTile([[],[],[],[],[]],0,2,2).retirements,0,'A floor without a big enough tile retires nothing');
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
    const sounds=[];
    const chain=merge({pace:1,random:seededRandom(5),message(){},sound:e=>sounds.push(e),finish(){}});chain.start();
    Object.assign(chain.state,{columns:[[8],[2,8],[],[],[]],column:2,value:2});chain.input({action:'left'});chain.input({action:'right'});
    assert.equal(chain.state.score,100,'20 for the 4, then 40 × 2 for the chained 16');assert.equal(chain.state.longestChain,2);
    assert.deepEqual(chain.state.replay.frames.map(f=>[f.kind,f.column,f.row,f.step,+(f.at-chain.state.time).toFixed(2)]),[['land',2,0,undefined,0],['merge',2,0,1,.14],['merge',0,0,2,.28]],'The landing shows first, then one merge frame every .14 s');
    assert.deepEqual(chain.state.notes,[{text:'chain ×2 · +100',at:chain.state.time+.28}],'The chain total is announced with its last step');
    assert.equal(sounds.filter(e=>['clear','bounce'].includes(e.kind)).length,0,'Cascade cues wait for their frame');
    chain.update(.15);assert.equal(sounds.filter(e=>['clear','bounce'].includes(e.kind)).length,1);
    chain.update(.15);assert.equal(sounds.filter(e=>['clear','bounce'].includes(e.kind)).length,2);
    assert.ok(chain.state.bursts.some(b=>b.text==='CHAIN ×2 +80'));
    chain.update(2);assert.equal(chain.state.replay,null,'A finished replay is dropped');assert.deepEqual(chain.state.notes,[]);
    assert.equal(s.pending,null);assert.equal(s.column,3,'A chord does not also move');assert.equal(s.refunds,0,'The next tile starts with a fresh refund allowance');
    assert.equal(s.budget,DROP.budget);assert.ok(Math.abs(s.deadline-s.time-DROP.budget)<1e-9);
    const before=s.drops;advance(DROP.budget+.05);assert.equal(s.drops,before+1,'The deadline drops the tile by itself');
    s.columns=[[128],[],[],[2],[2,8]];s.column=0;s.value=128;s.best=128;
    g.input({action:'left'});g.input({action:'right'});
    assert.equal(s.floor,4);assert.equal(s.retirements,1);assert.deepEqual(s.columns,[[256],[],[],[4],[8]],'The touching 2s cascade into a 4 before the floor doubles; nothing left to retire');
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
        return {drops,over:results.length>0,retirements:s.retirements,score:s.score};
    };
    for(let seed=1;seed<=4;seed++){
        const chance=play('random',seed,400),skill=play('greedy',seed,900);
        assert.ok(chance.over&&chance.drops<200,`seed ${seed}: random lasted ${chance.drops}`);
        assert.ok(skill.drops>=900&&!skill.over,`seed ${seed}: greedy lasted only ${skill.drops}`);
        assert.ok(skill.retirements>=3,'The floor keeps rising instead of saturating the board');
        assert.ok(Number.isSafeInteger(skill.score)&&skill.score<1e6,`seed ${seed}: a long run scores ${skill.score}, which the score store must still accept`);
        assert.ok(new ScoreStore(null).record(games.find(game=>game.engine==='merge'),skill.score),'A long run can still be saved');
    }
});

test('an unattended Tile Drop overflows into Game over and reduced motion changes nothing',()=>{
    const a=setup(merge),b=setup(merge,{reducedMotion:true});
    for(let i=0;i<30000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<600);assert.deepEqual(a.s,b.s);
});

test('Metro Line departs on its timetable, routes by junction 1 at 40% and junction 2 at 70%, and pays convoys',()=>{
    const {g,s,advance,sounds}=setup(rail);
    assert.equal(departureInterval(1),RAIL.interval);assert.equal(departureInterval(10),RAIL.minInterval);assert.equal(travelSeconds(1),RAIL.travel);
    assert.equal(s.schedule.length,RAIL.ahead);assert.equal(s.schedule[0].at,RAIL.firstDeparture);
    assert.ok(s.schedule.every(d=>['A','B'].includes(d.letter)),'Only open stations are scheduled');
    g.input({action:'right'});assert.equal(s.refusedAt,0,'No second junction exists at the start: R is harmless');
    s.schedule=[{letter:'B',at:1,id:1},{letter:'B',at:1.6,id:2},{letter:'A',at:90,id:3},{letter:'A',at:93,id:4}];
    advance(1.05);assert.equal(s.trains.length,1,'A train leaves when its time comes');
    assert.equal(s.root,0);advance(RAIL.travel*RAIL.root);
    g.input({action:'left'});assert.equal(s.root,1,'Switched after the train read junction 1');
    advance(RAIL.travel*(1-RAIL.root)+.05);
    assert.equal(s.lives,2);assert.equal(s.score,0);assert.ok(sounds.some(e=>e.kind==='miss'));
    assert.equal(s.trains.length,1,'The second train is already on the track');
    advance(RAIL.travel);
    assert.equal(s.score,RAIL.points,'Junction 1 set to the right branch delivers B');
    s.schedule=[{letter:'B',at:s.time+.1,id:5},{letter:'B',at:s.time+.8,id:6},{letter:'A',at:300,id:7},{letter:'A',at:303,id:8}];
    advance(RAIL.travel+1);
    assert.equal(s.served,3);assert.equal(s.score,RAIL.points*3+RAIL.convoy);assert.equal(s.convoy,1);
    assert.ok(sounds.some(e=>e.kind==='powerup'));
});

test('Metro Line opens stations behind new junctions at hard-coded times and junction 2 only acts on the open branch',()=>{
    const {g,s,advance}=setup(rail);
    assert.deepEqual([stageAt(0),stageAt(39.9),stageAt(40),stageAt(90)],[0,0,1,2]);
    assert.deepEqual(openStations(1).map(st=>st.letter),['A','B','C']);assert.deepEqual(openStations(2).map(st=>st.letter),['A','B','C','D']);
    assert.equal(hasChild(1,0),false);assert.equal(hasChild(1,1),true);assert.equal(hasChild(2,0),true);
    assert.equal(destination(1,1,0).letter,'B');assert.equal(destination(1,1,1).letter,'C');assert.equal(destination(2,0,1).letter,'D');assert.equal(destination(0,0,1).letter,'A');
    s.schedule=[{letter:'A',at:500,id:1}];
    advance(40.1);assert.equal(s.stage,1);assert.ok(s.bursts.some(b=>b.text==='NEW STATION C'));
    s.root=0;g.input({action:'right'});assert.deepEqual(s.children,[0,0],'The left branch has no second junction at stage 1');
    g.input({action:'left'});g.input({action:'right'});assert.deepEqual(s.children,[0,1],'R toggles the junction on the open branch');
    s.schedule=[{letter:'C',at:s.time+.1,id:9},{letter:'A',at:500,id:10}];
    advance(RAIL.travel+.3);assert.equal(s.score,RAIL.points,'Root right and child outer reach C');
    advance(50);assert.equal(s.stage,2);assert.ok(s.bursts.some(b=>b.text==='NEW STATION D')||s.time>=90);
    assert.ok(s.schedule.every(d=>['A','B','C','D'].includes(d.letter)));
});

test('an unattended Metro Line misroutes trains into Game over, and reduced motion changes nothing',()=>{
    const a=setup(rail),b=setup(rail,{reducedMotion:true});
    for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<120);assert.deepEqual(a.s,b.s);
});

test('Metro engines use the shared illustrated host policy, declared clocks, and isolated versioned scores',()=>{
    for(const [engine,version] of [['memory',2],['merge',4],['rail',3]]){
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
    assert.deepEqual(['memory','merge','rail','binary','snake','popups','maze'].map(livesLabel),['Lives',null,'Lives','Attempts','Lives',null,null],'The HUD names what each game spends');
});
