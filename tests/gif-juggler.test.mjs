import test from 'node:test';
import assert from 'node:assert/strict';
import { juggle, JUGGLER, CONTACT_Y, catchPoints } from '../arcade/games/gif-juggler.js';
import { GameRunner } from '../arcade/core/runner.js';
import { games } from '../arcade/catalog.js';

function setup(options={}) {
    const sounds=[],messages=[],results=[];
    const g=juggle({pace:1,reducedMotion:false,sound:event=>sounds.push(event),
        message:text=>messages.push(text),finish:text=>results.push(text),...options});
    g.start();
    const advance=seconds=>{for(let left=seconds;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));};
    return {g,s:g.state,sounds,messages,results,advance};
}
function falling(ball,y=240) { Object.assign(ball,{y,velocity:100,contactAt:null,wakeAt:0}); }

test('late catches increase points, actual contact doubles them and ascending/empty raises are harmless',()=>{
    const {g,s,messages,sounds}=setup();
    assert.ok(catchPoints(190)<catchPoints(270));
    assert.equal(catchPoints(CONTACT_Y,true),2*catchPoints(CONTACT_Y));
    g.input({action:'left'});assert.equal(s.score,0);assert.equal(s.catches,0);
    assert.deepEqual(messages,[]);assert.deepEqual(sounds,[]);
    falling(s.balls[0],220);g.input({action:'left'});
    const early=s.score;
    g.input({action:'left'});assert.equal(s.score,early,'Holding/spamming cannot score on an ascending GIF');
    falling(s.balls[0],290);g.input({action:'left'});assert.ok(s.score-early>early);
    falling(s.balls[0],CONTACT_Y);s.balls[0].contactAt=s.time;
    const before=s.score;g.input({action:'left'});
    assert.equal(s.score-before,100);assert.equal(s.bursts.at(-1).detail,'EDGE x2');
    assert.equal(s.inputFeedback.hideAll,true,'The game owns local feedback, without a generic circle');
});

test('both wrists remain independent and one lift catches every eligible GIF in its own lane',()=>{
    const {g,s}=setup();
    s.balls.push({...s.balls[0],id:2});
    for(const ball of s.balls)falling(ball);
    g.input({action:'left'});
    assert.equal(s.catches,2);
    assert.ok(s.balls[0].velocity<0&&s.balls[2].velocity<0);
    assert.ok(s.balls[1].velocity>0,'The other wrist still has its own catch');
    assert.equal(s.score,catchPoints(240)*2+25);
    g.input({action:'right'});assert.equal(s.catches,3);
});

test('contact has real-time grace independent of world speed and a miss costs only one life before recovery',()=>{
    for(const pace of [.8,3]) {
        const {s,advance}=setup({pace});
        falling(s.balls[0],CONTACT_Y-.1);s.balls[1].wakeAt=100;
        advance(1/120);
        assert.equal(s.balls[0].y,CONTACT_Y);assert.notEqual(s.balls[0].contactAt,null);
        advance(.25);assert.equal(s.lives,3);
        advance(.05);assert.equal(s.lives,2);assert.equal(s.balls[0].contactAt,null);
        advance(.4);assert.equal(s.lives,2,'No repeated life drain from the same dropped object');
    }
});

test('earned gifts alternate slow time and rescue, and a net saves once without manual score',()=>{
    const {g,s,advance}=setup();s.balls[1].wakeAt=100;
    for(let i=0;i<4;i++){falling(s.balls[0]);g.input({action:'left'});}
    assert.equal(s.balls[0].power,'slow');assert.equal(s.slowUntil,0,'The marked gift must be caught again');
    falling(s.balls[0]);g.input({action:'left'});assert.equal(s.slowUntil,JUGGLER.slowSeconds);
    for(let i=0;i<3;i++){falling(s.balls[0]);g.input({action:'left'});}
    assert.equal(s.balls[0].power,'net');
    falling(s.balls[0]);g.input({action:'left'});assert.equal(s.net,true);
    const score=s.score;
    falling(s.balls[0],CONTACT_Y);s.balls[0].contactAt=s.time;
    advance(.31);
    assert.equal(s.net,false);assert.equal(s.lives,3);assert.equal(s.score,score);
    assert.equal(s.bursts.at(-1).text,'SAVED');
    falling(s.balls[0],CONTACT_Y);s.balls[0].contactAt=s.time;advance(.31);
    assert.equal(s.lives,2,'The consumed net cannot silently save another miss');
});

test('slow time affects motion but not survival time, contact grace or the arrival schedule',()=>{
    const a=setup(),b=setup();
    for(const run of [a,b])for(const ball of run.s.balls)falling(ball,180);
    b.s.slowUntil=5;
    a.advance(.3);b.advance(.3);
    assert.equal(a.s.time,b.s.time);assert.ok(b.s.balls[0].y<a.s.balls[0].y);
    for(const run of [a,b]){
        run.s.time=24.99;run.s.slowUntil=100;
        run.advance(.03);assert.equal(run.s.balls.length,3);
        run.s.time=54.99;run.advance(.03);assert.equal(run.s.balls.length,4);
        run.s.time=120;run.advance(.03);assert.equal(run.s.balls.length,4);
    }
});

test('a comfortable timed player can continue past 60 seconds, while idle play naturally ends',()=>{
    let now=0;
    const description=games.find(game=>game.engine==='juggle');
    const runner=new GameRunner({...description,seed:5},juggle,{clock:()=>now});
    runner.play();
    let next=[0,0];
    for(let frame=0;frame<90*60;frame++) {
        now+=1000/60;runner.step(now);
        for(const lane of [0,1])if(runner.elapsed>=next[lane]&&runner.game.state.balls.some(ball=>ball.lane===lane&&
            ball.velocity>0&&ball.y>=260)){
            runner.router.dispatch(lane?'right':'left',{source:'motion',timestamp:now});
            next[lane]=runner.elapsed+1.2;
        }
        if(runner.phase==='finished')break;
    }
    assert.ok(runner.elapsed>60,'A catalog duration must not end survival play');
    assert.ok(runner.game.state.score>500);assert.equal(runner.game.state.balls.length,4);
    const idle=setup();idle.advance(25);
    assert.equal(idle.s.lives,0);assert.deepEqual(idle.results,['Connection lost']);
    runner.dispose();
});

test('reduced-motion decoration never changes timing, gifts, scores or loss and pause freezes all clocks',()=>{
    const runs=[setup(),setup({reducedMotion:true})];
    for(const run of runs){
        for(let i=0;i<400;i++){
            run.advance(.025);
            if(i%32===0)for(const action of ['left','right'])run.g.input({action});
        }
        run.g.pause();const frozen=structuredClone(run.s);
        run.g.update(5);run.g.input({action:'left'});assert.deepEqual(run.s,frozen);
    }
    assert.deepEqual(runs[0].s,runs[1].s);
});
