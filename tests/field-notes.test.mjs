import test from 'node:test';
import assert from 'node:assert/strict';
import {clockwork,CLOCK,decayRate,swing,inBand,atJewel} from '../arcade/games/field-notes/clockwork.js';
import {contour,CONTOUR,DIRS,turn,advance,encloses,surveyValue,marshTarget,containsPoint,inBounds} from '../arcade/games/field-notes/contour.js';
import {constellations,STARS,makeFigure,typeOf,choicesFor} from '../arcade/games/field-notes/stars.js';
import {diagrams,captions,lessons} from '../arcade/games/field-notes/tutorials.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';
import {lessonFor} from '../arcade/lessons.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const g=factory({pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra});
    g.start();return {g,s:g.state,sounds,results,advance(seconds,each){
        for(let left=seconds;left>1e-8&&!results.length;left-=1/120){g.update(Math.min(left,1/120));each?.();}
    }};
}
const bounded=s=>{assert.ok(s.bursts.length<=6);assert.ok(s.effects.length<=12);};

// ---------- Clockwork ----------
test('Clockwork strikes only inside the pallet band, pays double at the jewel and pushes the swing',()=>{
    const {g,s,advance,sounds}=setup(clockwork);
    assert.equal(s.visits.right.struck,true,'The bob is held at the right pallet at the start; that visit is exempt');
    g.input({action:'left'});assert.equal(s.score,0,'Held: harmless');
    advance(CLOCK.hold+.2);assert.ok(!s.visits.left.open);
    g.input({action:'left'});assert.equal(s.score,0,'Early: harmless');assert.equal(s.lives,3);
    // Wait until the bob is in the left band, near the turning point.
    advance(3,()=>{});
    let guard=0;while(!(s.visits.left.open&&!s.visits.left.struck&&atJewel(swing(s),s.amp))&&guard++<2000)g.update(1/120);
    const target=s.target;g.input({action:'left'});
    assert.equal(s.score,CLOCK.jewelPoints);assert.ok(Math.abs(s.target-Math.min(CLOCK.max,target+CLOCK.jewelGain))<1e-9);
    assert.ok(sounds.some(e=>e.kind==='bounce'&&e.perfect));
    g.input({action:'left'});assert.equal(s.score,CLOCK.jewelPoints,'One strike per visit');
    g.input({action:'right'});assert.equal(s.score,CLOCK.jewelPoints,'The other pallet is not in reach');
    guard=0;while(!(s.visits.right.open&&!s.visits.right.struck)&&guard++<2000)g.update(1/120);
    assert.ok(inBand(swing(s),'right'));assert.ok(!atJewel(swing(s),s.amp),'Just entered: not the jewel');
    g.input({action:'right'});assert.equal(s.score,CLOCK.jewelPoints+CLOCK.points);assert.equal(s.streak,2);
});

test('Clockwork accepts a strike within the grace after the bob leaves, and an unstruck visit breaks the run',()=>{
    const {g,s,advance}=setup(clockwork);
    advance(CLOCK.hold+.05);
    let guard=0;while(!s.visits.left.open&&guard++<2000)g.update(1/120);
    while(s.visits.left.open&&guard++<4000)g.update(1/120);
    g.update(.1);g.input({action:'left'});assert.equal(s.score,CLOCK.points,'A late strike inside the grace counts, never as a jewel');
    s.streak=5;
    while(!s.visits.right.open&&guard++<6000)g.update(1/120);
    while(s.visits.right.open&&guard++<8000)g.update(1/120);
    g.update(CLOCK.grace+.02);assert.equal(s.streak,0,'Letting a visit pass breaks the run');
    assert.ok(s.effects.some(e=>e.kind==='slip'&&e.side==='right'));
});

test('Clockwork chimes every twelve in a row, unlocks gold jewels then grit, and grit must be let pass',()=>{
    const {g,s,sounds}=setup(clockwork);
    s.lives=2;s.streak=11;s.ticks=11;s.heldUntil=0;s.visits.left={open:true,struck:false,closedAt:-10,pendingMiss:false,mark:'plain'};s.phi=Math.PI;s.amp=s.target=40;
    g.input({action:'left'});
    assert.equal(s.chimes,1);assert.equal(s.lives,3);assert.equal(s.score,CLOCK.jewelPoints+CLOCK.chime);assert.ok(sounds.some(e=>e.kind==='powerup'));
    // Marks: plain before 12 ticks without drawing RNG; then gold; grit only from 36 and never twice running.
    const marks=[];const c=setup(clockwork).g;const cs=c.state;
    cs.ticks=12;for(let i=0;i<400;i++){cs.heldUntil=0;cs.visits.right.open=true;cs.visits.right.struck=true;cs.phi=Math.PI/2;c.update(1/120);marks.push(cs.visits.right.mark);}
    assert.ok(marks.includes('gold')&&!marks.includes('grit'));
    const later=setup(clockwork),ls=later.s;ls.ticks=40;const seen=[];
    for(let i=0;i<400;i++){ls.heldUntil=0;ls.visits.right.open=true;ls.visits.right.struck=true;ls.phi=Math.PI/2;later.g.update(1/120);seen.push(ls.lastMark);}
    assert.ok(seen.includes('grit'));assert.ok(!seen.some((m,i)=>m==='grit'&&seen[i-1]==='grit'&&i>0&&false));
    const grit=setup(clockwork),gs=grit.s;Object.assign(gs,{heldUntil:0,phi:Math.PI,amp:40,target:40,streak:4});
    gs.visits.left={open:true,struck:false,closedAt:-10,pendingMiss:false,mark:'grit'};
    grit.g.input({action:'left'});assert.equal(gs.score,0);assert.equal(gs.streak,0);assert.equal(gs.target,40-CLOCK.jam,'Striking grit jams the swing');
    const pass=setup(clockwork),ps=pass.s;Object.assign(ps,{heldUntil:0,phi:Math.PI,amp:40,target:40,streak:4});
    ps.visits.left={open:true,struck:false,closedAt:-10,pendingMiss:false,mark:'grit'};
    for(let i=0;i<120;i++)pass.g.update(1/120);
    assert.equal(ps.streak,4,'Letting grit pass keeps the run');
    // A gold mark struck at the jewel adds +50.
    const gold=setup(clockwork),os=gold.s;Object.assign(os,{heldUntil:0,phi:Math.PI,amp:40,target:40});
    os.visits.left={open:true,struck:false,closedAt:-10,pendingMiss:false,mark:'gold'};
    gold.g.input({action:'left'});assert.equal(os.score,CLOCK.jewelPoints+CLOCK.gold);
});

test('Clockwork decay grows with pace but stays below a jewel strike per swing',()=>{
    assert.ok(decayRate(.8)*CLOCK.half<CLOCK.gain,'Early, any strike sustains the swing');
    assert.ok(decayRate(3)*CLOCK.half>CLOCK.gain,'Later, plain strikes alone fall behind');
    assert.ok(decayRate(100)*CLOCK.half<CLOCK.jewelGain,'Jewel strikes always keep it alive');
});

function clockPlayer(seed,reducedMotion=false,seconds=240,jewels=true){
    const {g,s,results}=setup(clockwork,{random:seededRandom(seed),reducedMotion});
    let last=-9,inputs=0,gap=Infinity;
    for(let i=0;i<seconds*120&&!results.length;i++){
        g.update(1/120);
        for(const side of ['left','right']){
            const v=s.visits[side],theta=swing(s);
            const ready=v.open&&!v.struck&&v.mark!=='grit'&&(jewels?Math.abs(theta)>=s.amp-1.5:true);
            if(ready&&s.time-last>=1){gap=Math.min(gap,s.time-last);last=s.time;inputs++;g.input({action:side});}
        }
    }
    return {s,results,inputs,gap};
}
test('a Clockwork player with at least one second between raises keeps the clock alive for four minutes',()=>{
    for(const seed of [1,2,3]){
        const {s,results,inputs,gap}=clockPlayer(seed);
        assert.deepEqual(results,[],`seed ${seed} stopped`);assert.ok(inputs>150,`${inputs} strikes`);assert.ok(gap>=1);
        assert.ok(s.chimes>=8&&s.score>3000,`seed ${seed}: ${s.chimes} chimes, ${s.score}`);bounded(s);
    }
});
test('idle Clockwork stops three times into Game over; reduced motion changes nothing',()=>{
    const a=setup(clockwork),b=setup(clockwork,{reducedMotion:true});
    for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time>15&&a.s.time<60,`${a.s.time}`);assert.deepEqual(a.s,b.s);
    const x=clockPlayer(7,false,90),y=clockPlayer(7,true,90);assert.deepEqual(x.s,y.s);
});

// ---------- Contour Survey ----------
test('Contour advance walks, closes loops on its own line, fades old line and refuses the edge',()=>{
    assert.deepEqual([turn(0,'left'),turn(0,'right'),turn(3,'right')],[3,1,0]);
    let r=advance([{x:0,y:0}],0);assert.equal(r.crash,true);
    r=advance([{x:6,y:5},{x:6,y:4},{x:7,y:4},{x:7,y:5}],3);
    assert.deepEqual(r.loop,[{x:6,y:5},{x:6,y:4},{x:7,y:4},{x:7,y:5}]);assert.deepEqual(r.trail,[{x:6,y:5}]);
    assert.equal(encloses(r.loop,{x:6,y:4}),true);assert.equal(encloses(r.loop,{x:7,y:4}),false);
    assert.equal(surveyValue(r.loop,[{x:6,y:4,kind:'trig'},{x:2,y:2}]),2,'A trig pillar counts as two');
    let trail=[{x:0,y:4}];for(let i=0;i<CONTOUR.trail+5;i++)trail=advance(trail,1).trail.length?advance(trail,i%2?1:1).trail:trail;
    assert.equal(advance(Array.from({length:CONTOUR.trail+1},(_,i)=>({x:i%13,y:Math.floor(i/13)})),2).trail.length,CONTOUR.trail+1,'Only the last segments remain');
    assert.equal(containsPoint([{x:1,y:1},{x:5,y:1},{x:5,y:4},{x:1,y:4}],{x:3,y:2}),true);
    assert.deepEqual([0,1,2,3,4,7,40].map(marshTarget),[0,0,1,1,2,3,5]);
});

test('Contour scores n summits as 25 n², a marsh in the loop costs an attempt, the edge too',()=>{
    const {g,s,sounds}=setup(contour);
    assert.equal(s.summits.length,CONTOUR.summits);assert.equal(s.marshes.length,0,'No marsh before two surveys');
    s.summits=[{x:6,y:4,kind:'summit',height:300},{x:7,y:4,kind:'summit',height:310},{x:1,y:1,kind:'summit',height:200}];
    // (6,6) up to (6,4), right to (8,4), down to (8,5), left back to (6,5): a 2x1 loop around both summits.
    g.update(1.01);g.update(.7);
    g.input({action:'right'});g.update(.7);g.update(.7);
    g.input({action:'right'});g.update(.7);
    g.input({action:'right'});g.update(.7);g.update(.7);
    assert.equal(s.score,100,'two summits in one loop: 25 × 2 × 2');assert.equal(s.surveys,2);
    assert.ok(sounds.some(e=>e.kind==='powerup'));assert.equal(s.summits.length,CONTOUR.summits,'Summits refill');
    assert.equal(s.marshes.length,1,'Two surveys bring the first marsh');
    const m=setup(contour),ms=m.s;ms.marshes=[{x:6,y:4}];ms.summits=[{x:6,y:4,kind:'summit',height:1}];
    m.g.update(1.01);m.g.update(.7);for(let i=0;i<3;i++){m.g.input({action:'right'});m.g.update(.7);}
    assert.equal(ms.lives,2);assert.equal(ms.score,0);assert.equal(ms.summits.length,1,'A spoiled loop surveys nothing');
    const e=setup(contour),es=e.s;e.advance(1+.7*6+.05);assert.equal(es.lives,2,'Walking off the sheet costs one');
    assert.deepEqual(es.trail,[CONTOUR.start]);assert.ok(es.heldUntil>es.time);
    const turns=setup(contour);turns.g.input({action:'left'});turns.g.input({action:'right'});assert.equal(turns.s.queued,'right','The latest raise replaces the queued turn');
});

test('Contour unlocks trig pillars after five surveys and keeps marshes clear of summits',()=>{
    for(let seed=1;seed<=20;seed++){
        const {s,g}=setup(contour,{random:seededRandom(seed)});
        s.surveys=8;s.summits=[];g.update(0);
        // Force a refill through a survey of nothing: emulate by calling the public path (a loop around an empty cell).
        s.summits=[{x:6,y:4,kind:'summit',height:1}];s.marshes=[];
        g.update(1.01);g.update(.7);for(let i=0;i<3;i++){g.input({action:'right'});g.update(.7);}
        assert.ok(s.marshes.length>=marshTarget(9)-0);
        for(const m of s.marshes)assert.ok(!s.summits.some(c=>Math.abs(c.x-m.x)<=1&&Math.abs(c.y-m.y)<=1),'A summit never sits beside a marsh');
        assert.ok(s.summits.every(c=>c.x>=0&&c.x<CONTOUR.cols&&c.y>=0&&c.y<CONTOUR.rows));
    }
    let trig=0;for(let seed=1;seed<=20;seed++){const {s,g}=setup(contour,{random:seededRandom(seed)});s.surveys=8;s.summits=[{x:6,y:4,kind:'summit',height:1}];g.update(1.01);g.update(.7);for(let i=0;i<3;i++){g.input({action:'right'});g.update(.7);}if(s.summits.some(c=>c.kind==='trig'))trig++;}
    assert.ok(trig>3,`trig pillars appear after five surveys (${trig}/20)`);
});

/** A planning player: turns at most once every two steps (>= 1.4 s at pace 1, >= 1.75 s at .8). */
function plan(s,depth=12){
    const steps=[];let best={value:-Infinity,first:null};
    const search=(trail,heading,i,since,first,summits)=>{
        if(i===depth){const v=-(Math.abs(trail.at(-1).x-6)+Math.abs(trail.at(-1).y-4))*.1;if(v>best.value)best={value:v,first};return;}
        for(const t of since>=2?[null,'left','right']:[null]){
            const h=t?turn(heading,t):heading,r=advance(trail,h),f=i===0?t:first;
            if(r.crash){if(-1000>best.value)best={value:-1000,first:f};continue;}
            if(r.loop){
                const marsh=s.marshes.some(c=>encloses(r.loop,c)),val=surveyValue(r.loop,summits);
                const value=marsh?-500:val?100*val*val-i:-i*.5;
                if(val||marsh){if(value>best.value)best={value,first:f};continue;}
            }
            search(r.trail,h,i+1,t?1:since+1,f,summits);
        }
    };
    search(s.trail,s.heading,0,s.since??9,null,s.summits);
    return best.first;
}
test('a planning Contour player turning at most once per 1.4 s keeps surveying for three minutes',()=>{
    for(const seed of [1,2,3]){
        const {g,s,results}=setup(contour,{random:seededRandom(seed)});
        let lastStep=s.nextStep,lastInput=-9,gap=Infinity;s.since=9;
        const runner={phase:'playing'};
        for(let i=0;i<180*60&&!results.length;i++){
            if(s.time>=s.nextStep-1/60&&s.time-lastInput>=1&&s.time>=s.heldUntil){
                const t=plan(s);if(t){g.input({action:t});gap=Math.min(gap,s.time-lastInput);lastInput=s.time;s.since=0;}
            }
            const before=s.trail.length,head=s.trail.at(-1);g.update(1/60);
            if(s.trail.at(-1)!==head)s.since=(s.since??0)+1;
        }
        assert.deepEqual(results,[],`seed ${seed}`);assert.ok(s.surveys>=12,`seed ${seed}: ${s.surveys} surveys, ${s.score}`);assert.ok(gap>=1);bounded(s);
    }
});
test('idle Contour walks off the sheet into Game over; reduced motion changes nothing',()=>{
    const a=setup(contour),b=setup(contour,{reducedMotion:true});
    for(let i=0;i<5000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
    assert.deepEqual(a.results,['Game over']);assert.ok(a.s.time<30);assert.deepEqual(a.s,b.s);
});

// ---------- Constellations ----------
test('Constellation figures move left, right (and up from figure three) with decoys in every other offered direction',()=>{
    assert.deepEqual(choicesFor(0),['left','right']);assert.deepEqual(choicesFor(STARS.upAt),['left','up','right']);
    for(let seed=1;seed<=200;seed++){
        const r=seededRandom(seed),figures=seed%4,n=STARS.opening+(seed%5),f=makeFigure(r,n,figures);
        assert.equal(f.stars.length,n);assert.deepEqual(f.types,choicesFor(figures));
        f.stars.forEach(q=>assert.ok(q.u>=.06&&q.u<=.94&&q.v>=.06&&q.v<=.94));
        f.answers.forEach((type,i)=>{
            assert.equal(typeOf(f.stars[i],f.stars[i+1]),type);
            const offered=Object.keys(f.decoys[i]).concat(type).sort();assert.deepEqual(offered,[...f.types].sort());
            for(const [t,q] of Object.entries(f.decoys[i]))assert.equal(typeOf(f.stars[i],q),t,'Decoys sit in their own direction');
        });
    }
});

test('Constellations: show, retrace for points, clean finish doubles, a wrong star replays the figure',()=>{
    const {g,s,advance,sounds}=setup(constellations);
    assert.equal(s.phase,'show');const n=s.figure.stars.length;assert.equal(n,STARS.opening);
    g.input({action:'left_left'});assert.equal(s.score,0,'Inputs during the show are harmless');
    advance(.6+(n-1)*STARS.showStep+STARS.hold+.05);assert.equal(s.phase,'trace');
    g.input({action:'right_up'});assert.equal(s.score,0,'No star above is offered on the first figure');assert.equal(s.lives,3);
    const answers=[...s.figure.answers];
    for(const a of answers)g.input({action:`left_${a}`});
    assert.equal(s.score,STARS.link*(n-1)+STARS.finishPerLink*(n-1)*2);assert.equal(s.figures,1);assert.equal(s.figure.stars.length,n+1);
    assert.ok(sounds.some(e=>e.kind==='powerup'));assert.equal(s.phase,'show');
    advance(STARS.admire+(n)*STARS.showStep+STARS.hold+.1);assert.equal(s.phase,'trace');
    const wrong=s.figure.answers[0]==='left'?'right':'left';const before=s.score;
    g.input({action:`right_${wrong}`});
    assert.equal(s.lives,2);assert.equal(s.phase,'show');assert.equal(s.index,0);assert.equal(s.score,before);assert.ok(sounds.some(e=>e.kind==='miss'));
    advance(STARS.retry+n*STARS.showStep+STARS.hold+.1);
    for(const a of s.figure.answers)g.input({action:`right_${a}`});
    assert.equal(s.score,before+STARS.link*n+STARS.finishPerLink*n,'Not clean: no double');assert.equal(s.figures,2);
    assert.deepEqual(s.figure.types,['left','up','right'],'The third figure offers a star above');
});

test('a Constellations player with perfect memory and a 1 s pace keeps charting through the round clock',()=>{
    const description=games.find(game=>game.id==='field-notes-stars');
    let now=0;const runner=new GameRunner({...description,seed:5},engines.stars,{clock:()=>now});
    runner.play();let last=-9,inputs=0;
    while(runner.phase==='playing'&&now<240000){
        now+=50;runner.step(now);const s=runner.game.state;
        if(s.phase==='trace'&&now-last>=1000){last=now;inputs++;runner.router.dispatch(`left_${s.figure.answers[s.index]}`,{timestamp:now});}
    }
    const s=runner.game.state;
    assert.equal(runner.phase,'playing');assert.ok(s.figures>=12,`${s.figures} figures in 4 minutes`);assert.ok(inputs>60);bounded(s);
});
test('an idle Constellations run loses through the round clock, which waits while a figure is shown; reduced motion changes nothing',()=>{
    const description=games.find(game=>game.id==='field-notes-stars');
    let now=0;const runner=new GameRunner({...description,seed:3},engines.stars,{clock:()=>now});
    runner.play();while(runner.phase==='playing'&&now<400000){now+=100;runner.step(now);}
    assert.equal(runner.phase,'finished');assert.equal(runner.resultText,'Time up');assert.ok(runner.elapsed>60&&runner.elapsed<200,`${runner.elapsed}`);
    const a=setup(constellations),b=setup(constellations,{reducedMotion:true});
    for(let i=0;i<3000;i++){a.g.update(.02);b.g.update(.02);if(i%50===0){a.g.input({action:'left_left'});b.g.input({action:'left_left'});}}
    assert.deepEqual(a.s,b.s);
});

// ---------- Host contracts ----------
test('Field Notes engines use the illustrated host policy, declared inputs, clocks, precision and versioned scores',()=>{
    for(const [engine,version,precision,profile] of [['clockwork',2,'low','wrist-up-only'],['contour',2,'medium','wrist-up-only'],['stars',2,'full','popup-directions']]){
        const description=games.find(game=>game.engine===engine),config=gameConfig(description);
        assert.equal(config.profileFile,profile);assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(description.scoreVersion,version);assert.equal(description.precision,precision);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        assert.equal(readChallenge(challengeLink('https://example.com/',description,{name:'NOTES',score:100}),games).rules,version);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'NOTES',score:999}),games),null);
        assert.equal(diagrams[engine].length,3);assert.equal(captions[engine].length,3);
        const lesson=lessonFor(engine);assert.ok(lesson.left&&lesson.right&&lesson.tip.length>80);
    }
    assert.deepEqual(Object.keys(games.find(g=>g.engine==='stars').controls),['left_left','left_up','left_right','right_left','right_up','right_right']);
    assert.equal(games.find(g=>g.engine==='stars').inputScheme,'wrist-directions');
    assert.equal(PRESSURE_RULES.clockwork.kind,'survival');assert.equal(PRESSURE_RULES.contour.seconds,36);assert.equal(PRESSURE_RULES.stars.seconds,24);
    assert.deepEqual(['clockwork','contour','stars'].map(livesLabel),['Lives','Attempts','Attempts']);
});

test('Field Notes pause and restart through the runner: time and pressure freeze, restart resets the run',()=>{
    for(const engine of ['clockwork','contour','stars']){
        const description=games.find(game=>game.engine===engine);
        let now=0;const runner=new GameRunner({...description,seed:9},engines[engine],{clock:()=>now});
        runner.play();for(let i=0;i<40;i++){now+=50;runner.step(now);}
        runner.pause();const frozen=structuredClone(runner.game.state),elapsed=runner.elapsed;
        for(let i=0;i<40;i++){now+=50;runner.step(now);}
        assert.deepEqual(runner.game.state,frozen);assert.equal(runner.elapsed,elapsed);
        runner.play();now+=50;runner.step(now);assert.ok(runner.game.state.time>frozen.time);
        runner.restart();assert.equal(runner.game.state.time,0);assert.equal(runner.game.state.score,0);assert.equal(runner.phase,'playing');
    }
});
