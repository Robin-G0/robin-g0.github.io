import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMaze, MAZE_LEVELS } from '../arcade/games/link-maze-map.js';
import { maze, MAX_SECONDS, EXIT_SECONDS } from '../arcade/games/link-maze.js';
import { seededRandom } from '../arcade/core/random.js';
import { GameRunner } from '../arcade/core/runner.js';

function create(seed=8) {
    const run={finished:false};
    run.g=maze({random:seededRandom(seed),pace:.8,finish:()=>run.finished=true});
    run.g.start();return run;
}
function advance(g,seconds) { for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60); }
function nextEffect(g,effect,side=0) {g.state.map.nodes[g.state.map.nodes[g.state.current].children[side]].effect=effect;}

test('time-seeded mazes get deeper with bounded width and every route reaches the common exit',()=>{
    for(let seed=0;seed<50;seed++)for(let level=1;level<=3;level++) {
        const map=generateMaze(seededRandom(seed),level);
        assert.deepEqual(map,generateMaze(seededRandom(seed),level));
        const seen=new Set(),lengths=[];
        function walk(id) {
            if(seen.has(id))return;seen.add(id);
            const node=map.nodes[id];
            assert.ok(node.x>=0&&node.x<=1);
            if(!node.children.length){assert.equal(node.effect,'exit');lengths.push(node.depth);return;}
            assert.equal(node.children.length,2);
            assert.ok(map.nodes[node.children[0]].x<node.x&&map.nodes[node.children[1]].x>node.x,'Choices match visible left/right');
            for(const child of node.children){assert.equal(map.nodes[child].depth,node.depth+1,'Every move advances one row; no cycles');walk(child);}
        }
        walk(0);assert.equal(seen.size,map.nodes.length);
        assert.equal(Math.min(...lengths),map.minDepth);assert.equal(Math.max(...lengths),map.maxDepth);
        for(const effect of ['points','seconds','reveal','tax','delay','flip'])assert.ok(map.nodes.some(n=>n.effect===effect));
        for(const id of map.route)assert.ok(!['tax','delay','flip'].includes(map.nodes[id].effect));
        assert.ok(map.nodes.length<=1+6*map.maxDepth,'Mobile maps do not grow exponentially');
        for(let depth=1;depth<=map.maxDepth;depth++)assert.ok(map.nodes.filter(n=>n.depth===depth).length<=6);
    }
    assert.deepEqual(MAZE_LEVELS.map(r=>r.maxDepth),[8,10,12]);
    assert.notDeepEqual(generateMaze(seededRandom(1700000000),2),generateMaze(seededRandom(1700000001),2));
});

test('both maze halves mix plain, bonus and penalty pages while a clean route always exists',()=>{
    const harmful=new Set(['tax','delay','flip','fatal']),bonus=new Set(['points','seconds','reveal']);
    for(let seed=0;seed<250;seed++)for(const round of [1,2,3,4,7,10]){
        const map=generateMaze(seededRandom(seed),Math.min(3,round),round);
        const halves=[true,false].map(left=>map.nodes.filter(n=>n.id&&n.children.length&&(n.x<.5)===left));
        for(const cells of halves){
            assert.ok(cells.some(n=>n.effect==='none'),'Both sides contain ordinary pages');
            assert.ok(cells.some(n=>bonus.has(n.effect)),'Bonuses never all sit on one side');
            assert.ok(cells.some(n=>harmful.has(n.effect)),'Penalties never all sit on one side');
            assert.ok(cells.filter(n=>n.effect==='none').length/cells.length>=.3);
        }
        const rate=(cells,set)=>cells.filter(n=>set.has(n.effect)).length/cells.length;
        assert.ok(Math.abs(rate(halves[0],bonus)-rate(halves[1],bonus))<.12);
        assert.ok(Math.abs(rate(halves[0],harmful)-rate(halves[1],harmful))<.12);
        assert.ok(map.route.every(id=>!harmful.has(map.nodes[id].effect)));
        // Find a clean route independently of the generator's solution metadata.
        const memo=new Map();
        function clean(id){
            if(memo.has(id))return memo.get(id);
            const n=map.nodes[id],ok=!harmful.has(n.effect)&&(!n.children.length||n.children.some(clean));
            memo.set(id,ok);return ok;
        }
        assert.equal(clean(0),true);
        assert.equal(map.nodes.some(n=>n.effect==='fatal'),round>3);
        assert.ok(map.nodes.some(n=>n.effect==='none'&&n.id&&!map.route.includes(n.id)&&n.children.length),'Plain pages are not just a marked safe path');
    }
});

test('later rounds apply the harsher penalty values printed in their map',()=>{
    for(const [round,tax,delay,flip] of [[1,25,5,2],[4,100,11,3],[8,200,19,5]]){
        for(const effect of ['tax','delay','flip']){
            const {g}=create(),s=g.state;s.completed=round-1;s.stage='navigate';s.score=1000;s.remaining=40;
            s.map=generateMaze(seededRandom(8),Math.min(3,round),round);
            nextEffect(g,effect);g.input({action:'left'});
            if(effect==='tax')assert.equal(s.score,1000-tax);
            if(effect==='delay')assert.equal(s.remaining,40-delay);
            if(effect==='flip')assert.equal(s.flipped,flip);
            assert.equal(s.map.effects.tax.label,`\u2212${tax}`);
            assert.equal(s.map.effects.delay.label,`\u2212${delay}s`);
            assert.equal(s.map.effects.flip.label,`\u2194 ${flip}`);
        }
    }
});

test('round four spawns lethal traps and stepping on one immediately ends the run',()=>{
    const run=create(),g=run.g,s=g.state;
    for(let round=1;round<=3;round++){
        assert.equal(s.map.nodes.some(n=>n.effect==='fatal'),false);
        advance(g,s.map.preview+.05);
        for(const side of s.map.shortRoute)g.input({action:side?'right':'left'});
        advance(g,1.4);
    }
    assert.equal(s.map.round,4);assert.ok(s.map.nodes.some(n=>n.effect==='fatal'));
    s.stage='navigate';s.remaining=90;nextEffect(g,'fatal');g.input({action:'left'});
    assert.equal(run.finished,true);assert.equal(s.stage,'over');assert.equal(s.reason,'fatal');assert.equal(s.remaining,0);
});

test('preview reveals before navigation and costs no time; inputs cannot skip it',()=>{
    const {g}=create(),s=g.state;
    g.input({action:'left'});assert.equal(s.current,0);
    advance(g,s.map.preview+.05);assert.equal(s.stage,'navigate');
    assert.ok(s.remaining>44.9);
    const before=s.remaining;advance(g,1);assert.ok(Math.abs(s.remaining-(before-1))<.001);
    g.pause();const paused=structuredClone(s);g.input({action:'left'});g.update(2);assert.deepEqual(s,paused);
});

test('points, time, penalties and reveals have bounded, immediate effects',()=>{
    for(const [effect,expectedScore,expectedTime]of [['points',140,40],['tax',75,40],['seconds',100,45],['delay',100,35],['reveal',100,40]]) {
        const {g}=create(),s=g.state;s.stage='navigate';s.score=100;s.remaining=40;
        nextEffect(g,effect);g.input({action:'left'});
        assert.equal(s.score,expectedScore);assert.equal(s.remaining,expectedTime);
        assert.equal(s.inputFeedback.hideAll,true,'No ring drawn over link text');
        if(effect==='reveal') {
            assert.equal(s.peek,2);
            nextEffect(g,'none');g.input({action:'left'});assert.equal(s.peek,1);
            nextEffect(g,'none');g.input({action:'left'});assert.equal(s.peek,0);
        }
    }
    const {g}=create();g.state.stage='navigate';g.state.score=0;nextEffect(g,'tax');g.input({action:'left'});assert.equal(g.state.score,0);
    g.state.current=0;g.state.remaining=MAX_SECONDS;nextEffect(g,'seconds');g.input({action:'left'});assert.equal(g.state.remaining,MAX_SECONDS);
});

test('flip swaps exactly the next two choices, independent of the wrist used',()=>{
    const {g}=create(),s=g.state;s.stage='navigate';nextEffect(g,'flip');g.input({action:'left'});
    assert.equal(s.flipped,2);
    for(const remaining of [1,0]) {
        const destination=s.map.nodes[s.current].children[1];s.map.nodes[destination].effect='none';
        g.input({action:'left'});assert.equal(s.current,destination);assert.equal(s.flipped,remaining);
    }
    const destination=s.map.nodes[s.current].children[0];
    g.input({action:'left'});assert.equal(s.current,destination);
});

test('home adds time and points, starts fresh maps and caps difficulty after three levels',()=>{
    const {g}=create(),s=g.state;
    const first=structuredClone(s.map);
    for(let round=0;round<5;round++) {
        advance(g,s.map.preview+.05);
        assert.equal(s.stage,'navigate');
        for(const side of s.map.shortRoute)g.input({action:side?'right':'left'});
        assert.equal(s.stage,'arrival');assert.equal(s.completed,round+1);
        assert.ok(s.outcome.points>=100*s.level);assert.ok(s.remaining>=45);
        const budget=s.remaining;advance(g,1.4);assert.equal(s.stage,'preview');assert.equal(s.remaining,budget);
        assert.equal(s.level,Math.min(3,round+2));assert.equal(s.map.maxDepth,MAZE_LEVELS[s.level-1].maxDepth);
    }
    assert.notDeepEqual(s.map,first);assert.ok(EXIT_SECONDS>0);
});

test('time exhaustion ends play, including a time trap at low budget',()=>{
    for(const trap of [false,true]) {
        const run=create(),s=run.g.state;s.stage='navigate';s.remaining=.2;
        if(trap){nextEffect(run.g,'delay');run.g.input({action:'left'});}else advance(run.g,.3);
        assert.equal(run.finished,true);assert.equal(s.remaining,0);assert.equal(s.stage,'over');
    }
});

test('maze clock outlives the fixed duration, keeps running on tracking loss and respects manual pause',t=>{
    t.mock.method(Date,'now',()=>1700000000123);
    let now=1000,last;
    const runner=new GameRunner({duration:1,difficulty:'gentle'},maze,{clock:()=>now,changed:s=>last=s});
    assert.equal(runner.seed,1700000000123>>>0);
    runner.play();for(let i=0;i<100;i++){now+=100;runner.step(now);}runner.publish();
    assert.equal(runner.phase,'playing');assert.ok(last.remaining>=43);
    const budget=runner.game.state.remaining;
    for(let i=0;i<20;i++){now+=100;runner.step(now,{hold:true});}
    assert.ok(runner.game.state.remaining<budget-1.9,'Hiding a wrist cannot stop the countdown');
    const paused=runner.game.state.remaining;
    runner.pause();now+=1000;runner.step(now);assert.equal(runner.game.state.remaining,paused);
    runner.dispose();
});

test('preview and navigation both advance upward with screen-left and screen-right choices',async()=>{
    const {renderMaze}=await import('../arcade/games/link-maze-view.js');
    for(const height of [420,780]){
        const {g}=create(),texts=[];
        const painter=new Proxy({h:height,images:new Map(),text:(text,x,y)=>texts.push({text,x,y})},{get:(o,k)=>k in o?o[k]:()=>{}});
        renderMaze(g.state,painter,true);
        assert.ok(texts.find(t=>t.text==='START').y>texts.find(t=>t.text==='END').y);
        texts.length=0;g.state.stage='navigate';renderMaze(g.state,painter,true);
        const player=texts.find(t=>t.text==='@');
        const left=texts.find(t=>t.text==='L'),right=texts.find(t=>t.text==='R');
        assert.ok(player.y>left.y&&player.y>right.y);
        assert.ok(left.x<player.x&&right.x>player.x);
    }
});

test('preview does not disclose a chosen solution through text, line styles or animated route selection',async()=>{
    const {renderMaze}=await import('../arcade/games/link-maze-view.js');
    const {g}=create(),draw=()=>{
        const calls=[];
        const painter=new Proxy({h:1000,images:new Map()},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});
        renderMaze(g.state,painter,true);return calls;
    };
    const original=draw();
    g.state.map.route=[];g.state.map.shortRoute=[];
    assert.deepEqual(draw(),original,'The preview is independent of the generator solution metadata');
    const text=original.filter(c=>c[0]==='text').map(c=>c[1]);
    assert.equal(text.some(t=>t.includes('QUICK ROUTE')||/[\u2190\u2192]/u.test(t)),false);
});
