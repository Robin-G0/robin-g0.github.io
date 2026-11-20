import test from 'node:test';
import assert from 'node:assert/strict';
import {tangram,TANGRAM,SHAPES,transform,canon,applyOp,fits,minimalMoves,stageFor,pieceLimit} from '../arcade/games/material/tangram.js';
import {golf,GOLF,landing,parOf,makeHole,holePoints,holeStage,deadEnds,greedyFails,TRAP_SHARE} from '../arcade/games/material/golf.js';
import {balance,BALANCE,levelPoints,weightOf,fallSeconds,balanceStage} from '../arcade/games/material/balance.js';
import * as theme from '../arcade/games/material.js';
import {diagrams,captions,lessons} from '../arcade/games/material/tutorials.js';
import {seededRandom} from '../arcade/core/random.js';
import {GameRunner} from '../arcade/core/runner.js';
import {engines} from '../arcade/registry.js';
import {games} from '../arcade/catalog.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {gameConfig,livesLabel} from '../arcade/core/game-config.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';
import {lessonFor} from '../arcade/lessons.js';
import {Painter} from '../arcade/core/painter.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const g=factory({pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra});
    g.start();return {g,s:g.state,sounds,results,advance(seconds){for(let left=seconds;left>1e-8;left-=1/60)g.update(Math.min(left,1/60));}};
}
function painter(compact=false,h=420,bg='#faf9ff') {
    const context=new Proxy({},{get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
    const p=new Painter(context,{bg,ink:'#25263d',accent:'#5946b2',muted:'#62647e',border:'#d5d5e8',soft:'#e9e2ff',gold:'#956300',font:'Roboto'});
    p.compact=compact;p.h=h;return p;
}
/** Renders every few frames in both layouts and appearances, so drawing code is exercised against real states. */
function renderAll(g){for(const p of [painter(),painter(true,1500),painter(false,420,'#211e2b')])g.render(p);}

// ---------- Paper Tangram ----------
const solve=(shape,from,target)=>{
    const queue=[[from,[]]];
    while(queue.length){const [o,path]=queue.shift();if(fits(shape,o,target))return path;if(path.length>=4)continue;
        for(const op of ['cw','ccw','flip'])queue.push([applyOp(o,op),[...path,op]]);}
    return null;
};
const OPKEY={cw:'right',ccw:'left',flip:'up'};

test('Paper Tangram orientations: four turns or two flips are identity, a flip mirrors on screen, and every shape is chiral',()=>{
    for(const name of Object.keys(SHAPES)){
        const pts=SHAPES[name].points,o={turn:0,mirror:false};
        let r=o;for(let i=0;i<4;i++)r=applyOp(r,'cw');assert.equal(canon(pts,r.turn,r.mirror),canon(pts,0,false));
        const f=applyOp(applyOp(o,'flip'),'flip');assert.equal(canon(pts,f.turn,f.mirror),canon(pts,0,false));
        // A screen flip of a turned piece equals mirroring its picture in x.
        const turned={turn:1,mirror:false},flipped=applyOp(turned,'flip');
        const picture=transform(pts,1,false).map(([x,y])=>[-x,y]);
        const norm=list=>{const mx=Math.min(...list.map(v=>v[0])),my=Math.min(...list.map(v=>v[1]));return list.map(([x,y])=>`${x-mx},${y-my}`).sort().join('|');};
        assert.equal(canon(pts,flipped.turn,flipped.mirror),norm(picture));
        for(let t=0;t<4;t++)assert.notEqual(canon(pts,t,true),canon(pts,0,false),`${name} must not equal its mirror image turned ${t}`);
        for(let t=0;t<4;t++)for(const m of [false,true])assert.ok(minimalMoves(name,o,{turn:t,mirror:m})<=3);
    }
    assert.deepEqual([stageFor(0),stageFor(4),stageFor(5),stageFor(12),stageFor(24)],[0,0,1,2,3]);
    assert.equal(pieceLimit(1,false),TANGRAM.limit);assert.equal(pieceLimit(10,false),TANGRAM.minLimit);assert.equal(pieceLimit(1,true),TANGRAM.limit*TANGRAM.pairFactor);
});

test('Paper Tangram: sweeps turn, a raise flips, a match drops in and scores 10 plus 10 for the fewest moves; wrong turns are harmless',()=>{
    const {g,s,advance,sounds}=setup(tangram);
    const piece=s.pieces[0];assert.equal(piece.side,-1);
    piece.shape='ell';piece.target={turn:2,mirror:false};piece.min=minimalMoves('ell',piece,piece.target);assert.equal(piece.min,2);assert.equal(piece.mirror,false);assert.equal(piece.target.mirror,false,'No mirrored outlines before 5 fits');
    assert.ok(piece.min>=1);
    g.input({action:'left_right'});assert.equal(piece.turn,1);g.input({action:'right_left'});assert.equal(piece.turn,0,'Either wrist moves the single piece and opposite sweeps undo each other');
    assert.equal(s.lives,3);assert.equal(s.score,0);
    for(const op of solve(piece.shape,piece,piece.target))g.input({action:`left_${OPKEY[op]}`});
    assert.equal(piece.state,'fit');assert.equal(s.fitted,1);assert.equal(s.score,TANGRAM.base,'Two extra sweeps forfeit the clean bonus');
    assert.ok(sounds.some(e=>e.kind==='clear'));
    advance(TANGRAM.lock+.02);assert.equal(s.pieces.length,1);const next=s.pieces[0];assert.notEqual(next.id,piece.id);
    for(const op of solve(next.shape,next,next.target))g.input({action:`right_${OPKEY[op]}`});
    assert.equal(s.score,TANGRAM.base+TANGRAM.base+TANGRAM.clean,'Fewest moves earns the clean bonus');
    g.input({action:'left_up'});assert.equal(s.score,30,'Input during the drop-in is harmless');
});

test('Paper Tangram: a piece whose clock runs out costs a heart and the combo; idle play ends in Game over',()=>{
    const {s,advance,results,sounds}=setup(tangram);
    s.streak=5;s.combo=2;
    advance(TANGRAM.limit+.05);assert.equal(s.lives,2);assert.equal(s.combo,1);assert.equal(s.pieces[0].state,'crumple');assert.ok(sounds.some(e=>e.kind==='miss'));
    advance(TANGRAM.recovery);assert.equal(s.pieces[0].state,'live');
    advance(2*(TANGRAM.limit+TANGRAM.recovery)+.1);assert.deepEqual(results,['Game over']);assert.equal(s.lives,0);
});

test('Paper Tangram stages: mirrored outlines from 5 fits, a piece per wrist from 12, five-square shapes from 24, combo every 4',()=>{
    const {g,s,advance}=setup(tangram);
    const mirrored=[],tiers=new Set();let pairSeen=false;
    for(let n=0;n<30;n++){
        const live=s.pieces.filter(p=>p.state==='live');
        for(const piece of live){
            if(n>=5&&n<12)mirrored.push(piece.target.mirror);
            tiers.add(SHAPES[piece.shape].tier);
            if(piece.side>=0)pairSeen=true;
            const wrist=piece.side===1?'right':'left';
            for(const op of solve(piece.shape,piece,piece.target))g.input({action:`${wrist}_${OPKEY[op]}`});
            assert.equal(piece.state,'fit');
        }
        advance(TANGRAM.lock+.02);
    }
    assert.ok(mirrored.includes(true)&&mirrored.includes(false),'Stage 1 mixes mirrored and plain outlines');
    assert.ok(pairSeen);assert.equal(s.stage,3);assert.ok(tiers.has(1),'Five-square shapes join');
    assert.equal(s.combo,TANGRAM.maxCombo);assert.equal(s.lives,3);
    assert.equal(s.pieces.length,2);assert.deepEqual(s.pieces.map(p=>p.side).sort(),[0,1]);
    // Wrist ownership: the left wrist turns only the left piece.
    const [left,right]=[0,1].map(side=>s.pieces.find(p=>p.side===side));const rt=right.turn;
    g.input({action:'left_right'});assert.equal(right.turn,rt);assert.ok(left.moves===1||left.state==='fit');
    assert.ok(s.snacks.length<=2&&s.bursts.length<=6&&s.effects.length<=16,'Effects stay bounded');
});

test('Paper Tangram: a simulated player with at least 1 s between inputs keeps progressing for 5 minutes',()=>{
    for(const seed of [1,2,3]){
        const {g,s,advance,results}=setup(tangram,{random:seededRandom(seed),pace:1});
        let fitsAt60=0;
        while(s.time<300&&!results.length){
            advance(1);if(s.time>=60&&!fitsAt60)fitsAt60=s.fitted;
            const piece=s.pieces.filter(p=>p.state==='live').sort((a,b)=>(a.born+a.limit)-(b.born+b.limit))[0];
            if(!piece)continue;
            const path=solve(piece.shape,piece,piece.target);
            g.input({action:`${piece.side===1?'right':'left'}_${OPKEY[path[0]]}`});
            if(s.time%7<1)renderAll(g);
        }
        assert.deepEqual(results,[],`seed ${seed}: the planned player survives`);
        assert.ok(s.fitted>fitsAt60+40,`seed ${seed}: sustained fits ${fitsAt60} → ${s.fitted}`);
        assert.ok(Number.isSafeInteger(s.score));
    }
});

// ---------- Ripple Golf ----------
test('Ripple Golf landings: chips move 1, drives 3, pads push on, water and the sheet edge lose the shot',()=>{
    const cells=['grass','grass','pad','grass','grass','water','grass'];
    assert.deepEqual(landing(cells,0,1),{to:1,kind:'ok',path:[1]});
    assert.deepEqual(landing(cells,1,1),{to:3,kind:'ok',path:[2,3]},'A pad pushes the ball one more cell');
    assert.deepEqual([landing(cells,4,1).kind,landing(cells,4,1).to],['water',4],'The ball stays where it was');
    assert.deepEqual([landing(cells,4,3).kind,landing(cells,4,3).to],['out',4]);
    assert.equal(landing(cells,3,3).kind,'cup');
    assert.equal(parOf(cells),2,'Drive to 3, drive into the cup');
    assert.equal(parOf(['grass','water','water','water','grass']),Infinity);
});

test('Ripple Golf holes are always holeable, stages add water then pads, and par is the fewest strokes',()=>{
    for(let seed=1;seed<=40;seed++){
        const random=seededRandom(seed);
        for(const holes of [0,2,5,9,20]){
            const {cells,par}=makeHole(random,holes);
            assert.ok(Number.isFinite(par)&&par>=2,`seed ${seed} hole ${holes}`);if(holes<2)assert.deepEqual(deadEnds(cells),[]);assert.equal(cells[0],'grass');assert.equal(cells.at(-1),'grass');
            if(holes<2)assert.ok(!cells.includes('water')&&!cells.includes('pad'));
            if(holes<5)assert.ok(!cells.includes('pad'));
        }
    }
    assert.deepEqual([holeStage(0),holeStage(2),holeStage(5),holeStage(9)],[0,1,2,3]);
    assert.deepEqual([holePoints(3,3,1),holePoints(3,3,3),holePoints(3,3,9),holePoints(4,3,0),holePoints(6,3,0)],[50,70,100,30,10]);
});

test('Ripple Golf scores a hole by strokes against par, sends lost shots back to the tee, ignores inputs while the ball drops and deals the next hole',()=>{
    const {g,s,advance,sounds}=setup(golf);
    s.hole={cells:['grass','grass','grass','grass','water','grass','grass'],par:2};s.ball=0;
    g.input({action:'left'});assert.equal(s.ball,1);g.input({action:'right'});assert.equal(s.ball,0,'Water sends the ball back to the tee');
    assert.equal(s.strokes,3,'Stroke plus penalty');assert.ok(sounds.some(e=>e.kind==='thrust'));
    g.input({action:'right'});g.input({action:'right'});assert.equal(s.ball,6);
    assert.equal(s.solved,true);assert.equal(s.strokes,5);assert.equal(s.score,GOLF.other);assert.equal(s.holes,1);
    g.input({action:'right'});assert.equal(s.strokes,5,'Inputs while the ball drops are harmless');
    advance(2);assert.equal(s.solved,false);assert.equal(s.strokes,0);assert.equal(s.ball,0);
    s.hole={cells:['grass','grass','grass','grass','grass'],par:2};
    g.input({action:'right'});g.input({action:'left'});assert.equal(s.score,GOLF.other+GOLF.par);assert.equal(s.parStreak,1);
    advance(2);s.hole={cells:['grass','grass','grass','grass','grass','grass','grass'],par:2};
    g.input({action:'right'});g.input({action:'right'});assert.equal(s.parStreak,2);assert.equal(s.score,GOLF.other+GOLF.par*2+GOLF.streak);
    advance(2);s.hole={cells:['grass','grass','grass','grass'],par:1};
    g.input({action:'left'});g.input({action:'right'});assert.equal(s.ball,0,'Off the end: back to the tee');
    g.input({action:'right'});assert.equal(s.parStreak,0);assert.equal(s.score,GOLF.other*2+GOLF.par*2+GOLF.streak);
    assert.ok(s.bursts.length<=6&&s.effects.length<=16&&s.snacks.length<=2);
});

test('Ripple Golf: an idle run loses its attempts to the host round clock; planning beats always driving',()=>{
    const description=games.find(game=>game.id==='material-golf');
    let now=0;const runner=new GameRunner({...description,seed:4},engines.golf,{clock:()=>now});
    runner.play();while(runner.phase==='playing'&&now<600000){now+=100;runner.step(now);}
    assert.equal(runner.phase,'finished');assert.equal(runner.resultText,'Time up');assert.ok(runner.elapsed>45&&runner.elapsed<200,`${runner.elapsed}`);
    const best=(cells,from)=>{ // Breadth-first next move towards the cup.
        const end=cells.length-1,prev=new Map([[from,null]]),q=[from];
        while(q.length){const at=q.shift();for(const [a,step] of [['left',1],['right',3]]){const r=landing(cells,at,step);if(r.kind==='water'||r.kind==='out'||prev.has(r.to))continue;prev.set(r.to,[at,a]);q.push(r.to);}}
        let at=end,move=null;while(prev.get(at)){[at,move]=[prev.get(at)[0],prev.get(at)[1]];}return move||'left';
    };
    const greedy=(cells,from)=>{const r=landing(cells,from,3);return r.kind==='water'||r.kind==='out'?'left':'right';};
    const totals={};
    for(const [name,policy] of [['plan',best],['greedy',greedy]]){
        let sum=0;
        for(const seed of [1,2,3,4,5]){
            const description2={...description,seed};let t=0;const r=new GameRunner(description2,engines.golf,{clock:()=>t});
            r.play();
            while(r.phase==='playing'&&r.elapsed<300){t+=1000;r.step(t);const s=r.game.state;if(!s.solved)r.game.input({action:policy(s.hole.cells,s.ball)});}
            if(name==='plan')assert.equal(r.phase,'playing',`plan seed ${seed} keeps playing at one shot per second`);
            sum+=r.game.state.score;
            if(name==='plan')assert.ok(r.game.state.holes>=40,`${r.game.state.holes} holes in 5 minutes`);
        }
        totals[name]=sum;
    }
    assert.ok(totals.plan>totals.greedy,`planning ${totals.plan} > greedy ${totals.greedy}`);
});

// ---------- Paper Balance ----------
test('Paper Balance levels at equal weight for 5 × cards², gold doubles, and it tips past 4 or on a sixth card',()=>{
    assert.equal(levelPoints([{w:1},{w:1}]),20);assert.equal(levelPoints(Array(6).fill({w:1})),180);
    assert.equal(levelPoints([{w:1,gold:true},{w:1}]),40);assert.equal(levelPoints([{w:1,gold:true},{w:1,gold:true},{w:2,gold:true}]),180,'Gold caps at ×4');
    const {g,s,advance,sounds,results}=setup(balance);
    s.card={w:2,gold:false,id:90,born:s.time,fall:5};
    g.input({action:'left'});assert.deepEqual(s.trays.map(weightOf),[2,0]);
    s.card={w:1,gold:false,id:91,born:s.time,fall:5};g.input({action:'right'});
    s.card={w:1,gold:false,id:92,born:s.time,fall:5};g.input({action:'right'});
    assert.equal(s.score,45);assert.equal(s.clears,1);assert.deepEqual(s.trays,[[],[]],'A level clears both trays');
    assert.ok(sounds.some(e=>e.kind==='clear'));
    s.trays=[[],[{w:2},{w:2}]];s.card={w:1,gold:false,id:93,born:s.time,fall:5};g.input({action:'right'});
    assert.equal(s.lives,2,'5 apart tips');assert.deepEqual(s.trays,[[],[]]);assert.equal(s.card,null,'A short recovery before the next card');
    g.input({action:'left'});assert.equal(s.lives,2,'Inputs during recovery are harmless');
    advance(BALANCE.recovery+.02);assert.ok(s.card);
    s.trays=[[{w:1},{w:1},{w:1},{w:1},{w:1}],[{w:2},{w:2}]];s.card={w:1,gold:false,id:94,born:s.time,fall:5};g.input({action:'left'});
    assert.equal(s.lives,1,'A sixth card overflows the tray');assert.deepEqual(results,[]);
});

test('Paper Balance: unplaced cards fall into the lower tray, so idle play tips into Game over; reduced motion changes nothing',()=>{
    const a=setup(balance),b=setup(balance,{reducedMotion:true});
    a.s.trays=[[{w:1}],[]];a.s.card={w:2,gold:false,id:99,born:0,fall:1};a.advance(1.02);
    assert.deepEqual(a.s.trays[0].map(c=>c.w),[1,2],'Left was heavier, so the card fell left');
    const c=setup(balance),d=setup(balance,{reducedMotion:true});
    for(let i=0;i<20000&&!c.results.length;i++){c.g.update(.02);d.g.update(.02);if(i%250===0){renderAll(c.g);renderAll(d.g);}}
    assert.deepEqual(c.results,['Game over']);assert.ok(c.s.time<120,`${c.s.time}`);assert.deepEqual(c.s,d.s);
    assert.equal(fallSeconds(1),BALANCE.fall);assert.equal(fallSeconds(9),BALANCE.minFall);
    assert.deepEqual([balanceStage(0),balanceStage(3),balanceStage(8),balanceStage(14)],[0,1,2,3]);
});

test('Paper Balance: a simulated player placing 1 s after each card keeps levelling for 5 minutes with the preview; random placement tips out early',()=>{
    const play=(seed,policy)=>{
        const {g,s,advance,results}=setup(balance,{random:seededRandom(seed),pace:1.4});const rnd=seededRandom(seed+50);
        let waited=0;
        while(s.time<300&&!results.length){
            advance(.25);waited+=.25;
            if(s.card&&s.time-s.card.born>=1&&waited>=1){g.input({action:policy(s,rnd)});waited=0;}
            if(Math.floor(s.time)%11===0&&waited===0)renderAll(g);
        }
        return {over:results.length>0,clears:s.clears,score:s.score,stage:s.stage,time:s.time};
    };
    // Looks at the current card and the next one (the preview): never tip, level when it can, keep trays light.
    const careful=s=>{
        const evaluate=(trays,card,next,depth)=>{
            let best=-1e9,choice=0;
            for(const side of [0,1]){
                if(trays[side].length>=BALANCE.capacity)continue;
                const t2=trays.map(t=>[...t]);t2[side].push(card);
                const d=weightOf(t2[1])-weightOf(t2[0]);
                if(Math.abs(d)>BALANCE.limit)continue;
                let value=d===0?10:-Math.abs(d)-(t2[0].length+t2[1].length)*.3;
                if(d===0)t2[0]=t2[1]=[];
                if(depth&&next)value+=.8*evaluate(t2,next,null,0).value;
                if(value>best){best=value;choice=side;}
            }
            return {value:best,choice};
        };
        return evaluate(s.trays,s.card,s.next,1).choice?'right':'left';
    };
    for(const seed of [1,2,3]){
        const skill=play(seed,careful),chance=play(seed,(s,rnd)=>rnd()<.5?'left':'right');
        assert.ok(!skill.over&&skill.clears>=60&&skill.stage===3,`seed ${seed}: careful ${JSON.stringify(skill)}`);
        assert.ok(chance.over&&chance.time<skill.time&&chance.score<skill.score,`seed ${seed}: random ${JSON.stringify(chance)} vs careful ${skill.score}`);
    }
});

// ---------- Theme wiring ----------
test('Material engines use the illustrated host policy, declared clocks and precision, isolated versioned scores and real teaching text',()=>{
    assert.deepEqual(Object.keys(theme).sort(),['balance','golf','tangram']);
    for(const [engine,version,precision,directional] of [['tangram',2,'full',true],['golf',2,'low',false],['balance',2,'low',false]]){
        const description=games.find(game=>game.id===`material-${engine}`),config=gameConfig(description);
        assert.equal(description.illustrated,true);assert.equal(description.scoreVersion,version);assert.equal(description.precision,precision);
        assert.equal(config.directional,directional);assert.equal(config.profileFile,directional?'popup-directions':'wrist-up-only');
        assert.equal(config.outcomeFeedback,true);assert.equal(config.portraitBoard,true);
        assert.equal(Object.keys(description.controls).length,directional?6:2);
        const old={...description,scoreVersion:1},store=new ScoreStore(null);
        store.record(old,999);assert.equal(store.hasScore(description),false);assert.notEqual(scoreKey(old),scoreKey(description));
        assert.equal(readChallenge(challengeLink('https://example.com/',description,{name:'PAPER',score:100}),games).rules,version);
        assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'PAPER',score:999}),games),null);
        assert.equal(diagrams[engine].length,3);assert.equal(captions[engine].length,3);
        for(const svg of diagrams[engine])assert.match(svg,/^<svg [^>]*class="guide-art material-diagram"/);
        const lesson=lessonFor(engine);assert.ok(lesson.left&&lesson.right&&lesson.tip.length>80);
    }
    assert.deepEqual(['tangram','golf','balance'].map(e=>PRESSURE_RULES[e].kind),['survival','rounds','survival']);
    assert.equal(PRESSURE_RULES.golf.seconds,24);
    assert.deepEqual(['tangram','golf','balance'].map(livesLabel),['Lives','Attempts','Lives']);
});

test('Material runs pause and restart through the shared runner without losing determinism',()=>{
    for(const engine of ['tangram','golf','balance']){
        const description={...games.find(game=>game.id===`material-${engine}`),seed:9};
        let now=0;const runner=new GameRunner(description,engines[engine],{clock:()=>now});
        runner.play();for(let i=0;i<30;i++){now+=100;runner.step(now);}
        runner.pause();const frozen=structuredClone(runner.game.state),elapsed=runner.elapsed;
        for(let i=0;i<30;i++){now+=100;runner.step(now);}
        assert.deepEqual(runner.game.state,frozen);assert.equal(runner.elapsed,elapsed);
        runner.play();now+=100;runner.step(now);assert.ok(runner.elapsed>elapsed);
        runner.restart();assert.equal(runner.game.state.score,0);assert.equal(runner.elapsed,0);assert.equal(runner.phase,'playing');
    }
});
