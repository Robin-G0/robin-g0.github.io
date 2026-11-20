import test from 'node:test';
import assert from 'node:assert/strict';
import {school,SCHOOL,makeRow,afterHit,bankPoints,stageAt,travelSeconds,rowInterval} from '../arcade/games/aero/school.js';
import {bubbles,BUBBLES,PEBBLE,RAINBOW,CENTRE,landBubble,groupsOf,rainbowColor,groupPoints,colorsAt,pebbleEvery,riseSeconds} from '../arcade/games/aero/bubbles.js';
import {garden,GARDEN,applyWeather,batchPoints,bedsAt,needDeadline} from '../arcade/games/aero/garden.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';
import {Painter} from '../arcade/core/painter.js';
import {lessonFor} from '../arcade/lessons.js';
import {diagrams,captions} from '../arcade/games/aero/tutorials.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const g=factory({pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra});
    g.start();return {g,s:g.state,sounds,results,advance(seconds){for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));}};
}
function painter(h=420,compact=false){
    const gradient={addColorStop(){}};
    const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,measureText:()=>({width:80})},{get(t,k){return k in t?t[k]:()=>{};}});
    const p=new Painter(context,{bg:'#effbff',ink:'#123b50',muted:'#39667b',accent:'#076ca8',soft:'#c7e8f5',border:'#85bfcc',gold:'#41651b',font:'Arial'});
    p.h=h;p.compact=compact;return p;
}
/** Drives a runner with a policy that waits at least one second between inputs. */
function play(engine,policy,{seed=1,limit=300,reducedMotion=false}={}){
    const description=games.find(g=>g.engine===engine);let now=0,last=-10,inputs=0;
    const runner=new GameRunner({...description,seed},engines[engine],{clock:()=>now,reducedMotion});runner.play();
    while(runner.phase==='playing'&&runner.elapsed<limit){
        now+=50;runner.step(now);
        if(runner.phase==='playing'&&policy&&runner.elapsed-last>=1){const action=policy(runner.game.state);if(action){last=runner.elapsed;inputs++;runner.game.input({action});}}
    }
    return {runner,state:runner.game.state,inputs};
}

// ---------- School Rescue ----------
test('School Rescue rows keep a reachable safe lane, never block it and only place gates on the path',()=>{
    const random=seededRandom(7);let previous=1,offStray=null;
    for(let index=0;index<600;index++){
        const time=index*1.7,row=makeRow(random,{index,previous,offStray,time});
        assert.ok(Math.abs(row.safe-previous)<=1,'Each row is at most one lane from the last');
        if(offStray!=null)assert.ok(Math.abs(row.safe-offStray)<=1,'A detour for a stray can always return in one sweep');
        assert.ok(!row.jellies.includes(row.safe),'The safe lane is never stung');
        for(const stray of row.strays)assert.ok(!row.jellies.includes(stray.lane),'Strays never share a lane with a jellyfish');
        if(index<SCHOOL.calmRows)assert.equal(row.jellies.length,0,'The first rows are calm');
        if(row.kind==='row'&&index>=SCHOOL.calmRows)assert.equal(row.jellies.length,stageAt(time)===2?2:stageAt(time)===0?1:row.jellies.length);
        if(stageAt(time)===0)assert.ok(row.strays.every(st=>!st.gold),'Golden strays wait for 75 s');
        previous=row.safe;offStray=row.strays.find(st=>st.lane!==row.safe)?.lane??null;
    }
    assert.deepEqual([stageAt(0),stageAt(50),stageAt(100)],[0,1,2]);
    assert.deepEqual([afterHit(1),afterHit(3),afterHit(8),afterHit(15)],[1,2,4,8],'Half the followers scatter, the leader stays');
    assert.equal(bankPoints(7),70);assert.equal(travelSeconds(1),SCHOOL.travel);assert.equal(rowInterval(10),SCHOOL.minInterval);
});

test('School Rescue: sweeps change lane, strays join, gates bank 10 per fish and a pearl, stings scatter, a raised shield absorbs',()=>{
    const {g,s,sounds,advance}=setup(school);
    assert.equal(s.lane,1);assert.equal(s.fish,SCHOOL.startFish);
    g.input({action:'left_left'});assert.equal(s.lane,0);
    g.input({action:'right_left'});assert.equal(s.lane,0,'An edge bump is harmless');assert.equal(s.lastInput.ok,false);
    g.input({action:'right_right'});g.input({action:'left_right'});assert.equal(s.lane,2,'Either wrist sweeps either way');
    g.input({action:'left_up'});assert.equal(s.shieldUntil,-10,'No pearl: raising does nothing');assert.equal(s.lives,3);
    s.rows=[{kind:'row',safe:2,jellies:[],strays:[{lane:2,gold:false}],progress:.999,resolved:false,id:1}];s.nextRow=99;
    advance(.05);assert.equal(s.fish,4);assert.equal(s.score,SCHOOL.strayPoints);
    s.rows=[{kind:'gate',safe:2,jellies:[],strays:[],progress:.999,resolved:false,id:2}];
    advance(.05);assert.equal(s.score,5+40);assert.equal(s.pearls,1);assert.equal(s.homes,1);assert.ok(sounds.some(e=>e.kind==='clear'));
    s.rows=[{kind:'row',safe:0,jellies:[2],strays:[],progress:.999,resolved:false,id:3}];
    advance(.05);assert.equal(s.lives,2);assert.equal(s.fish,afterHit(4));assert.ok(sounds.some(e=>e.kind==='miss'));
    advance(SCHOOL.recovery);
    g.input({action:'right_up'});assert.equal(s.pearls,0);assert.ok(s.shieldUntil>s.time);
    s.rows=[{kind:'gate',safe:0,jellies:[],strays:[],progress:.999,resolved:false,id:4}];
    advance(.05);assert.equal(s.lives,2,'The shield absorbs the coral');assert.ok(s.shieldUntil<=s.time,'An absorbed hit pops the shield');
    s.rows=[{kind:'gate',safe:0,jellies:[],strays:[],progress:.999,resolved:false,id:5}];
    advance(.05);assert.equal(s.lives,1,'A used shield is gone');
});

test('an unattended School Rescue scatters into Game over and reduced motion changes nothing',()=>{
    const a=setup(school),b=setup(school,{reducedMotion:true}),p=painter();
    for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);if(i%50===0){a.g.render(p);b.g.render(painter(900,true));}}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<120,`idle lasted ${a.s.time}`);assert.deepEqual(a.s,b.s);
    assert.ok(a.s.rows.length<=6&&a.s.bursts.length<=6&&a.s.effects.length<=16,'Actors and effects stay bounded');
});

test('a School Rescue player sweeping at most once a second keeps the school alive and keeps banking',()=>{
    const policy=s=>{
        const next=s.rows.filter(r=>!r.resolved).sort((a,b)=>b.progress-a.progress)[0];if(!next)return null;
        let target=next.safe;const stray=next.strays[0];if(next.kind==='row'&&stray)target=stray.lane;
        return target<s.lane?'right_left':target>s.lane?'left_right':null;
    };
    for(const seed of [1,2,3]){
        const {runner,state,inputs}=play('school',policy,{seed,limit:240});
        assert.equal(runner.phase,'playing',`seed ${seed} ended early`);assert.ok(state.homes>=15,`seed ${seed}: ${state.homes} homes`);
        assert.ok(state.score>2000);assert.ok(inputs<=240);
    }
});

// ---------- Bubble Cascade ----------
test('Bubble Cascade pops groups of three across columns, cascades with a step multiplier and cracks pebbles',()=>{
    let columns=[[0],[0],[]];
    let result=landBubble(columns,2,0);
    assert.deepEqual(result.events.map(e=>e.kind),['land','pop']);assert.equal(result.points,groupPoints(3,1));assert.deepEqual(columns,[[],[],[]],'Sideways touches count');
    columns=[[1],[1],[]];result=landBubble(columns,0,2);assert.equal(result.points,0);assert.deepEqual(columns,[[1,2],[1],[]],'Two of a colour do not pop');
    // Cascade: popping the three aqua bubbles lets the left column float up, so its two leaf bubbles touch the leaf beside them.
    columns=[[1,1],[0,2,1],[0]];
    result=landBubble(columns,2,0);
    assert.deepEqual(result.events.filter(e=>e.kind==='pop').map(e=>e.step),[1,2]);
    assert.equal(result.points,groupPoints(3,1)+groupPoints(3,2));assert.deepEqual(columns,[[],[2],[]]);
    assert.deepEqual(result.events[1].board,[[1,1],[2,1],[]],'Each frame carries the board it leaves, for the replay');
    // Pebbles never group but crack beside a pop.
    columns=[[2,PEBBLE],[0,0],[PEBBLE,PEBBLE,PEBBLE,PEBBLE]];
    result=landBubble(columns,1,0);
    assert.deepEqual(columns,[[2],[],[PEBBLE]],'Pebbles touching the pop crack, the far one stays');assert.equal(result.points,groupPoints(3,1));
    assert.equal(groupsOf([[PEBBLE,PEBBLE,PEBBLE],[],[]]).length,0);
    assert.equal(rainbowColor([[3],[],[]],0),3);assert.equal(rainbowColor([[],[4],[]],0),4);assert.equal(rainbowColor([[],[],[]],2),0);
    columns=[[2,2],[],[]];result=landBubble(columns,0,RAINBOW);assert.equal(result.value,2);assert.deepEqual(columns,[[],[],[]]);
    columns=[[0,1,0,1,0,1,0,1],[],[]];assert.equal(landBubble(columns,0,2).overflow,true,'A ninth bubble passes the red line');
    assert.deepEqual([colorsAt(0),colorsAt(90),colorsAt(150)],[3,4,5]);assert.deepEqual([pebbleEvery(10),pebbleEvery(45),pebbleEvery(120)],[0,8,6]);
    assert.equal(riseSeconds(1),BUBBLES.rise);assert.equal(riseSeconds(9),BUBBLES.minRise);
});

test('Bubble Cascade sends left and right on raises, floats up the centre when left alone, rewards cascades with a rainbow and vents overflow',()=>{
    const {g,s,sounds,advance}=setup(bubbles);
    s.current.value=0;g.input({action:'left'});advance(BUBBLES.dart+.02);assert.deepEqual(s.columns[0],[0]);
    s.current.value=1;g.input({action:'right'});g.input({action:'left'});advance(BUBBLES.dart+.02);assert.deepEqual(s.columns[2],[1],'The first raise wins; a second during the dart is harmless');
    s.current.value=2;advance(BUBBLES.rise+BUBBLES.dart+.1);assert.deepEqual(s.columns[CENTRE],[2],'Waiting floats it up the centre');
    s.columns=[[1,1],[0,2,1],[0]];s.current.value=0;s.current.progress=0;g.input({action:'right'});advance(BUBBLES.dart+.02);
    assert.equal(s.score,groupPoints(3,1)+groupPoints(3,2));assert.equal(s.bestChain,2);assert.equal(s.rainbows+(s.next===RAINBOW?1:0)+(s.current.value===RAINBOW?1:0),1,'A cascade earns one rainbow bubble');
    advance(1);assert.ok(sounds.some(e=>e.kind==='powerup'),'The cascade step sounds when its frame shows');
    s.columns=[[],[0,1,0,1,0,1,0,1],[]];s.current.value=2;s.current.side=null;s.current.progress=.99;
    advance(.3);
    assert.equal(s.lives,2);assert.deepEqual(s.columns[1],[],'Overflow vents the column');assert.ok(sounds.some(e=>e.kind==='miss'));
});

test('an unattended Bubble Cascade fills its centre into Game over and reduced motion changes nothing',()=>{
    const a=setup(bubbles),b=setup(bubbles,{reducedMotion:true});
    for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);if(i%50===0){a.g.render(painter());b.g.render(painter(900,true));}}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<200,`idle lasted ${a.s.time}`);assert.deepEqual(a.s,b.s);
    assert.ok(a.s.bursts.length<=6&&a.s.effects.length<=16&&a.s.columns.every(c=>c.length<=BUBBLES.rows));
});

test('a Bubble Cascade player choosing at most once a second pops groups for minutes',()=>{
    const value=(columns,side,bubble)=>{const c=columns.map(x=>[...x]),r=landBubble(c,side,bubble);return r.points*2-(r.overflow?1e5:0)-Math.max(...c.map(x=>x.length))**2*10-(c[side].length>=6?200:0);};
    const policy=s=>{
        if(!s.current||s.current.side!=null||s.current.progress<.3)return null;
        const options=[0,1,2].map(c=>value(s.columns,c,s.current.value)),best=options.indexOf(Math.max(...options));
        return best===0?'left':best===2?'right':null;
    };
    for(const seed of [1,2,3]){
        const {runner,state}=play('bubbles',policy,{seed,limit:400});
        assert.ok(runner.elapsed>=140,`seed ${seed}: lasted ${runner.elapsed}`);assert.ok(state.popped>=60,`seed ${seed}: popped ${state.popped}`);
        const idle=play('bubbles',null,{seed,limit:400});assert.ok(state.score>idle.state.score*3,'Choosing beats waiting');
    }
});

// ---------- Living Garden ----------
test('Living Garden weather serves every matching plant, stresses the others and scores batches by n squared',()=>{
    const beds=[{growth:0,need:{type:'water',deadline:10,total:10}},{growth:0,need:{type:'water',deadline:10,total:10}},
        {growth:0,need:{type:'sun',deadline:10,total:10}},{growth:0,need:{type:'rainbow',deadline:10,total:14,water:false,sun:false}},{growth:0,need:null}];
    const rain=applyWeather(beds,'water',0);
    assert.deepEqual(rain,{served:[0,1],stressed:[2],halves:[3]});assert.ok(Math.abs(beds[2].need.deadline-10*(1-GARDEN.stress))<1e-9);
    beds[0].need=beds[1].need=null;
    const sun=applyWeather(beds,'sun',1);assert.deepEqual(sun.served,[2,3],'A rainbow plant completes with its second weather');
    assert.deepEqual([batchPoints(1),batchPoints(2),batchPoints(3),batchPoints(4)],[10,40,90,160]);
    assert.deepEqual([bedsAt(0),bedsAt(40),bedsAt(90)],[4,5,6]);assert.equal(needDeadline(1),GARDEN.deadline);assert.equal(needDeadline(10),GARDEN.minDeadline);
});

test('Living Garden grows plants, blooms the third serve, wilts on timeout and opens beds and rainbow plants on schedule',()=>{
    const {g,s,sounds,advance}=setup(garden);
    s.beds[0].need={type:'water',deadline:50,total:9,water:false,sun:false};s.beds[1].need={type:'water',deadline:50,total:9,water:false,sun:false};s.nextNeed=99;
    g.input({action:'left'});assert.equal(s.score,40);assert.deepEqual(s.beds.map(b=>b.growth),[1,1,0,0]);
    g.input({action:'left'});assert.equal(s.score,40,'Weather with nobody waiting scores nothing');
    s.beds[0].growth=2;s.beds[0].need={type:'sun',deadline:50,total:9,water:false,sun:false};
    g.input({action:'right'});assert.equal(s.blooms,1);assert.equal(s.beds[0].growth,0);assert.equal(s.score,40+10+GARDEN.bloomPoints);
    assert.ok(sounds.some(e=>e.kind==='powerup'));
    s.beds[2].need={type:'sun',deadline:s.time+.5,total:9,water:false,sun:false};
    advance(.6);assert.equal(s.lives,2);assert.equal(s.beds[2].need,null);assert.ok(sounds.some(e=>e.kind==='miss'));
    const late=setup(garden);late.s.lives=99;late.advance(91);
    assert.equal(late.s.beds.length,6);assert.ok(late.s.needs>=GARDEN.rainbowEvery);
});

test('an unattended Living Garden wilts into Game over and reduced motion changes nothing',()=>{
    const a=setup(garden),b=setup(garden,{reducedMotion:true});
    for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);if(i%50===0){a.g.render(painter());b.g.render(painter(900,true));}}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<60);assert.deepEqual(a.s,b.s);
    assert.ok(a.s.bursts.length<=6&&a.s.effects.length<=16);
});

test('a Living Garden player using weather at most once a second batches and survives for minutes',()=>{
    const policy=s=>{
        let water=0,sun=0,urgent=null,least=Infinity;
        for(const bed of s.beds){
            const need=bed.need;if(!need)continue;
            if(need.type==='water'||(need.type==='rainbow'&&!need.water))water++;
            if(need.type==='sun'||(need.type==='rainbow'&&!need.sun))sun++;
            const left=need.deadline-s.time;if(left<least){least=left;urgent=need.type==='rainbow'?(need.water?'sun':'water'):need.type;}
        }
        if(urgent&&least<2.2)return urgent==='water'?'left':'right';
        return water>=3?'left':sun>=3?'right':null;
    };
    for(const seed of [1,2,3]){
        const {runner,state}=play('garden',policy,{seed,limit:300});
        assert.equal(runner.phase,'playing',`seed ${seed} wilted out`);assert.ok(state.blooms>=20);assert.ok(state.bestBatch>=3,'Batches happen');
    }
});

// ---------- Host contract ----------
test('Aero engines declare versioned scores, illustrated host policy, survival pressure and their recommended precision',()=>{
    const expected={school:{precision:'full',directional:true,file:'popup-directions'},bubbles:{precision:'low',directional:false,file:'wrist-up-only'},garden:{precision:'low',directional:false,file:'wrist-up-only'}};
    for(const [engine,want] of Object.entries(expected)){
        const description=games.find(game=>game.id===`aero-${engine}`),config=gameConfig(description);
        assert.equal(description.scoreVersion,2);assert.equal(description.illustrated,true);assert.equal(description.precision,want.precision);
        assert.equal(config.directional,want.directional);assert.equal(config.profileFile,want.file);assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(PRESSURE_RULES[engine].kind,'survival');assert.equal(livesLabel(engine),'Lives');
        const old={...description,scoreVersion:1},store=new ScoreStore(null);store.record(old,999);
        assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        assert.equal(readChallenge(challengeLink('https://example.com/',description,{name:'AERO1',score:100}),games).rules,2);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'AERO1',score:999}),games),null);
        assert.equal(diagrams[engine].length,3);assert.equal(captions[engine].length,3);assert.ok(lessonFor(engine).tip.length>80);
        for(const svg of diagrams[engine])assert.match(svg,/class="guide-art aero-diagram"/);
    }
    const six=games.find(game=>game.id==='aero-school');
    assert.deepEqual(Object.keys(six.controls).sort(),['left_left','left_right','left_up','right_left','right_right','right_up']);
});

test('Aero runs pause, keep pressure without hands and restart cleanly through the shared runner',()=>{
    for(const engine of ['school','bubbles','garden']){
        const description=games.find(g=>g.engine===engine);let now=0;
        const runner=new GameRunner({...description,seed:4},engines[engine],{clock:()=>now});runner.play();
        for(let i=0;i<100;i++){now+=100;runner.step(now);}
        runner.pause();const frozen=structuredClone(runner.game.state);now+=5000;runner.step(now);
        runner.game.input({action:Object.keys(description.controls)[0]});assert.deepEqual(runner.game.state,frozen,`${engine}: paused state is frozen`);
        runner.play();now+=100;runner.step(now);assert.ok(runner.game.state.time>frozen.time);
        runner.restart();assert.equal(runner.game.state.score,0);assert.equal(runner.game.state.lives,3);assert.equal(runner.phase,'playing');
        runner.dispose();
    }
});
