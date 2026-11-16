import test from 'node:test';
import assert from 'node:assert/strict';
import {invaders,INVADERS} from '../arcade/games/phosphor/invaders.js';
import {lander,LANDER,landingPoints} from '../arcade/games/phosphor/lander.js';
import {snake,SNAKE,snakeStep,nextSnakeCell,snakeGlyph} from '../arcade/games/phosphor/snake.js';
import {seededRandom} from '../arcade/core/random.js';
import {ScoreStore,scoreKey} from '../arcade/core/scores.js';
import {games} from '../arcade/catalog.js';
import {readChallenge,challengeLink} from '../arcade/core/challenges.js';
import {createBunkers,strikeBunker,crushBunker,BUNKER} from '../arcade/games/phosphor/bunkers.js';

function setup(factory,extra={}) {
    const sounds=[],results=[];
    const g=factory({pace:1,random:seededRandom(123),message(){},sound:e=>sounds.push(e),finish:t=>results.push(t),...extra});
    g.start();return {g,s:g.state,sounds,results,advance(seconds){
        for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));
    }};
}
test('Invaders lane moves, automatic shots, chains and a clean fleet reward remain independent',()=>{
    const {g,s,advance}=setup(invaders);
    g.input({action:'left'});g.input({action:'right'});assert.equal(s.lane,3);
    assert.equal(s.inputFeedback.hideAll,true);
    advance(.3);assert.equal(s.bullets.length,1);
    s.aliens=[{id:1,lane:3,y:120},{id:2,lane:3,y:160}];
    s.bullets=[{lane:3,y:162}];g.update(.01);assert.equal(s.score,10);
    s.bullets=[{lane:3,y:122}];g.update(.01);
    assert.equal(s.score,130,'10 + chained 20 + clean wave 100');assert.equal(s.shield,true);
    advance(1.2);assert.equal(s.wave,2);assert.equal(s.aliens.length,14);
});
test('Invaders gives a full warning, one hit grace and bounded effects/actors',()=>{
    const {g,s,advance}=setup(invaders);
    s.nextAttack=0;g.update(.01);assert.equal(s.bombs[0].launchAt-s.time,INVADERS.warningSeconds);
    const bomb=s.bombs[0],y=bomb.y;advance(.5);assert.equal(bomb.y,y);
    s.shield=true;s.bombs=[{lane:3,y:317,launchAt:0},{lane:3,y:317,launchAt:0}];
    g.update(.02);assert.equal(s.lives,3);assert.equal(s.shield,false);
    s.bombs=[{lane:3,y:317,launchAt:0}];g.update(.02);assert.equal(s.lives,3);
    advance(1.2);s.bombs=[{lane:3,y:317,launchAt:0}];g.update(.02);assert.equal(s.lives,2);
    assert.ok(s.bullets.length<=16&&s.bombs.length<=6&&s.bursts.length<=6);
});
test('Lander fuel, braking cooldown and safe/perfect grading match the visible rules',()=>{
    const {g,s,advance}=setup(lander);s.velocity=60;
    g.input({action:'left_up'});assert.equal(s.velocity,42);assert.equal(s.fuel,96);
    s.velocity=60;g.input({action:'left_up'});assert.equal(s.fuel,96,'Charging brake costs nothing');
    advance(LANDER.brakeSeconds+.01);s.velocity=60;g.input({action:'left_up'});assert.equal(s.fuel,92);
    assert.equal(landingPoints(33,100),0);assert.equal(landingPoints(32,50),200);assert.equal(landingPoints(8,50),400);
    s.x=s.padX;s.y=319.99;s.velocity=7;s.fuel=50;g.update(.01);
    assert.equal(s.landings,1);assert.equal(s.score,400);assert.ok(s.recoveryUntil>s.time);
    advance(1.2);assert.equal(s.fuel,100);assert.ok(s.y>=64&&s.y<65);
});
test('Lander crashes cost one life, fuel cannot go negative and upward travel is bounded',()=>{
    const {g,s,advance,results}=setup(lander);
    s.fuel=5;g.input({action:'right_up'});assert.equal(s.fuel,5);
    s.y=55;s.velocity=-38;g.update(.01);assert.equal(s.y,55);assert.equal(s.velocity,0);
    for(let i=0;i<3;i++){
        s.y=319.99;s.velocity=50;g.update(.01);assert.equal(s.lives,2-i);
        if(i<2)advance(1.2);
    }
    assert.deepEqual(results,['Game over']);
});
test('Lander permits several landings with at least one second between discrete decisions',()=>{
    const {g,s,results}=setup(lander);let last=-10,moves=0;
    for(let i=0;i<7200&&!results.length;i++){
        if(s.time-last>=1&&!s.recoveryUntil){
            const action=Math.abs(s.x-s.padX)>18?(s.x>s.padX?'left_left':'right_right'):
                s.velocity>43?'right_up':s.velocity>28?'left_up':null;
            if(action){g.input({action});last=s.time;moves++;}
        }
        g.update(1/60);
    }
    assert.ok(s.landings>=3&&s.score>500);assert.ok(moves<100);
});
test('Snake replaces queued turns, permits a vacating tail, and rewards quick/cache pickups',()=>{
    const {g,s}=setup(snake);
    g.input({action:'left'});assert.deepEqual(nextSnakeCell(s),{x:5,y:3,direction:3});
    g.input({action:'right'});assert.deepEqual(nextSnakeCell(s),{x:5,y:5,direction:1});
    s.turn=null;s.food={x:6,y:4};g.update(1.5);assert.equal(s.score,40);
    s.food={x:7,y:4};s.foodAt=-10;s.nextStep=s.time;g.update(.01);assert.equal(s.score,60);
    s.eaten=3;s.food={x:8,y:4};s.foodAt=s.time;s.nextStep=s.time;
    const length=s.body.length;g.update(.01);assert.equal(s.score,180);assert.equal(s.body.length,length-1);
    s.body=[{x:1,y:1},{x:1,y:2},{x:2,y:2},{x:2,y:1}];s.direction=0;s.turn=null;
    s.food={x:9,y:8};s.nextStep=s.time;g.update(.01);assert.equal(s.lives,3);
    assert.equal(snakeStep(100,100),SNAKE.minStep);
});
test('Snake sustained traversal works with discrete corner pulses and no held repeats',()=>{
    const {g,s}=setup(snake);
    const path=[];
    for(let x=0;x<12;x++)for(let row=0;row<8;row++)path.push({x,y:x%2?8-row:row+1});
    for(let x=11;x>=0;x--)path.push({x,y:0});
    s.body=[{x:0,y:3},{x:0,y:2},{x:0,y:1}];s.direction=1;
    let last=-10,minGap=Infinity;
    for(let step=0;step<190;step++){
        const index=path.findIndex(p=>p.x===s.body[0].x&&p.y===s.body[0].y),target=path[(index+1)%path.length];
        const direction=target.x>s.body[0].x?0:target.y>s.body[0].y?1:target.x<s.body[0].x?2:3;
        if(direction!==s.direction){
            const delta=(direction-s.direction+4)%4;assert.ok(delta===1||delta===3);
            minGap=Math.min(minGap,s.time-last);last=s.time;g.input({action:delta===1?'right':'left'});
        }
        g.update(s.nextStep-s.time+.001);
        assert.equal(s.lives,3);
    }
    assert.ok(s.score>0&&s.time>120);assert.ok(minGap>=.7);
});
test('all Phosphor games eventually lose when idle and reduced motion preserves scoring/state',()=>{
    for(const factory of [invaders,lander,snake]){
        const a=setup(factory),b=setup(factory,{reducedMotion:true});
        for(let i=0;i<20000&&!a.results.length;i++){a.g.update(.02);b.g.update(.02);}
        assert.deepEqual(a.results,['Game over']);assert.deepEqual(a.s,b.s);
    }
});
test('revised rules isolate old score boards and reject incompatible friend targets',()=>{
    const description=games.find(g=>g.engine==='snake'),old={...description,scoreVersion:1};
    const store=new ScoreStore(null);store.record(old,999);assert.equal(store.hasScore(description),false);
    assert.notEqual(scoreKey(old),scoreKey(description));
    const link=challengeLink('https://example.com/',description,{name:'ALICE',score:100});
    assert.equal(readChallenge(link,games).rules,2);
    assert.equal(readChallenge(challengeLink('https://example.com/',old,{name:'ALICE',score:999}),games),null);
});

test('Lander steering cancels exactly inside the flight bounds and has no horizontal momentum',()=>{
    const {g,s,advance}=setup(lander);
    for(const x of [264,312,360,408,456]){
        s.x=x;const fuel=s.fuel,velocity=s.velocity;
        g.input({action:'left_left'});assert.equal(s.x,x-LANDER.step);
        g.input({action:'right_right'});assert.equal(s.x,x);
        g.input({action:'left_right'});assert.equal(s.x,x+LANDER.step);
        g.input({action:'right_left'});assert.equal(s.x,x);
        assert.equal(s.fuel,fuel);assert.equal(s.velocity,velocity);
    }
    s.x=360;advance(1);assert.equal(s.x,360,'Waiting cannot introduce lateral drift');
    s.x=LANDER.minX;g.input({action:'left_left'});assert.equal(s.x,LANDER.minX);
    s.x=LANDER.maxX;g.input({action:'right_right'});assert.equal(s.x,LANDER.maxX);
    s.velocity=60;g.input({action:'right_up'});assert.equal(s.velocity,60-LANDER.thrust);
    s.velocity=60;s.brakeAt=-10;g.input({action:'left_up'});assert.equal(s.velocity,60-LANDER.brake);
});

test('Lander accepts a broad pad edge but rejects off-pad touchdowns, with reachable repeatable pads',()=>{
    const {g,s,advance}=setup(lander);
    assert.equal(Math.abs((s.padX-360)%LANDER.step),0);assert.notEqual(s.padX,360);
    s.x=s.padX+48;s.y=319.99;s.velocity=7;g.update(.01);
    assert.equal(s.landings,1);assert.equal(s.touchdownGood,true);
    assert.equal(s.score,300,'Safe edge landing does not get a centered x2 bonus');
    advance(1.2);assert.equal(s.x,360);assert.notEqual(s.padX,264);
    s.x=s.padX-96;s.y=319.99;s.velocity=7;g.update(.01);
    assert.equal(s.lives,2);assert.equal(s.bursts.at(-1).text,'OFF PAD');
});

test('bunker bullets erode real cells, tunnels pass shots, skipped frames still collide and aliens crush cover',()=>{
    const bunkers=createBunkers(),bunker=bunkers[1];
    const hp=()=>bunker.cells.reduce((sum,cell)=>sum+cell.hp,0);
    const before=hp();assert.equal(strikeBunker(bunkers,3,320,250,1),true);
    assert.ok(hp()<before);assert.ok(bunker.cells.some(cell=>cell.hp===1));
    let absorbed=1;while(strikeBunker(bunkers,3,320,250,2)&&absorbed<20)absorbed++;
    assert.ok(absorbed<20);assert.equal(strikeBunker(bunkers,3,250,320,3),false,'The drilled tunnel works both ways');
    const other=bunkers[0],intact=other.cells.reduce((sum,cell)=>sum+cell.hp,0);
    assert.equal(strikeBunker(bunkers,1,100,320,4),true);
    assert.ok(other.cells.reduce((sum,cell)=>sum+cell.hp,0)<intact);
    crushBunker(bunkers,{lane:1,y:BUNKER.top+30});assert.ok(other.cells.every(cell=>cell.hp===0));
});

test('Invaders cover absorbs a bomb before the player, and its holes persist across waves',()=>{
    const {g,s,advance}=setup(invaders);
    const before=s.bunkers[1].cells.reduce((sum,cell)=>sum+cell.hp,0);
    s.bombs=[{lane:3,y:264,launchAt:0}];g.update(.02);
    assert.equal(s.lives,3);assert.equal(s.bombs.length,0);
    assert.ok(s.bunkers[1].cells.reduce((sum,cell)=>sum+cell.hp,0)<before);
    for(const cell of s.bunkers[0].cells)cell.hp=0;
    s.aliens=[];g.update(.01);advance(1.2);
    assert.ok(s.bunkers[0].cells.every(cell=>cell.hp===0));
});

test('Snake head glyph is unambiguous in every direction and differs from every body segment',()=>{
    assert.deepEqual([0,1,2,3].map(direction=>snakeGlyph(direction)),['>','v','<','^']);
    for(let direction=0;direction<4;direction++){
        assert.equal(snakeGlyph(direction,false),'o');assert.notEqual(snakeGlyph(direction),snakeGlyph(direction,false));
    }
});
