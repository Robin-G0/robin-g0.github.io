import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESSURE_RULES, RoundPressure, pressureMultiplier } from '../arcade/core/pressure.js';
import { GameRunner } from '../arcade/core/runner.js';
import { game } from '../arcade/core/game.js';
import { games } from '../arcade/catalog.js';
import { engines } from '../arcade/registry.js';

test('every arcade engine has an explicit pressure policy and pressure grows with time',()=>{
    assert.deepEqual(Object.keys(PRESSURE_RULES).sort(),games.map(g=>g.engine).sort());
    assert.equal(pressureMultiplier(0),1);
    assert.ok(pressureMultiplier(30)>1);
    assert.ok(pressureMultiplier(180)>pressureMultiplier(60));
});

test('puzzle deadlines renew only on score, shorten over time and allow memorisation',()=>{
    const pressure=new RoundPressure(24,1);
    pressure.step(10,0);assert.equal(pressure.remaining(10),14);
    pressure.step(12,10);const early=pressure.remaining(12);
    pressure.step(20,10,true);assert.equal(pressure.remaining(20),early);
    pressure.step(100,20);assert.ok(pressure.remaining(100)<early);
    assert.equal(pressure.step(200,20),true);
    assert.equal(pressure.step(200,20),false,'One timeout cannot trigger a failure burst');
});

test('survival engines outlive catalog duration, ramp their pace and never hold for tracking',()=>{
    let now=0,environment;
    const runner=new GameRunner({engine:'school',duration:1,difficulty:'gentle'},env=>{
        environment=env;return game({}, {update(){},render(){}});
    },{clock:()=>now});
    runner.play();const opening=environment.pace;
    for(let tick=0;tick<100;tick++){now+=100;runner.step(now,{hold:true});}
    assert.equal(runner.phase,'playing');assert.ok(runner.elapsed>9.9);
    assert.ok(environment.pace>opening);
    runner.pause();const pace=environment.pace;now+=5000;runner.step(now);assert.equal(environment.pace,pace);
    runner.dispose();
});

test('puzzle rounds continue past catalog duration and three expired goals end play',()=>{
    let now=0,last;
    const runner=new GameRunner({engine:'binary',duration:1,difficulty:'gentle'},()=>game({}, {render(){}}),
        {clock:()=>now,changed:state=>last=state});
    runner.play();
    for(let tick=0;tick<20;tick++){now+=100;runner.step(now);}
    runner.publish();assert.equal(runner.phase,'playing');assert.equal(last.clockLabel,'Next score');
    for(let tick=0;tick<1500&&runner.phase==='playing';tick++){now+=100;runner.step(now,{hold:true});}
    assert.equal(runner.phase,'finished');assert.equal(runner.game.state.lives,0);
    runner.restart();assert.equal(runner.phase,'playing');assert.equal(runner.game.state.lives,3);
    assert.equal(runner.game.remainingSeconds(),30);runner.dispose();
});

test('neglected Aero fish and plants lose naturally without a camera or timed cutoff',()=>{
    for(const engine of ['school','garden']){
        let now=0;
        const runner=new GameRunner({engine,duration:1,seed:8,difficulty:'gentle'},engines[engine],{clock:()=>now});
        runner.play();
        for(let tick=0;tick<1200&&runner.phase==='playing';tick++){now+=100;runner.step(now);}
        assert.equal(runner.phase,'finished',`${engine} cannot score unattended forever`);
        assert.equal(runner.game.state.lives,0);runner.dispose();
    }
});
