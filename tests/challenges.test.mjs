import test from 'node:test';
import assert from 'node:assert/strict';
import {games} from '../arcade/catalog.js';
import {engines} from '../arcade/registry.js';
import {PRESSURE_RULES} from '../arcade/core/pressure.js';
import {gameConfig} from '../arcade/core/game-config.js';
import {ChallengeStore,challengeLink,readChallenge,compareChallenge} from '../arcade/core/challenges.js';

test('every catalog game has shared host configuration, a trusted factory and pressure policy',()=>{
    assert.equal(new Set(games.map(game=>game.id)).size,games.length);
    for (const game of games) {
        assert.equal(typeof engines[game.engine],'function');assert.ok(PRESSURE_RULES[game.engine]);
        const config=gameConfig(game);assert.ok(config.profile.inputs.length);
        assert.equal(config.directional,['popups','lander'].includes(game.engine));
        const link=challengeLink('https://example.com/profile/?unrelated=1#main',game,{name:'ALICE',score:123});
        assert.equal(readChallenge(link,games).game,game.id);
        assert.equal(new URL(link).searchParams.get('theme'),game.theme);
    }
});

test('challenge links roundtrip only known game, difficulty, bounded name and integer target',()=>{
    const game=games[0],url=challengeLink('https://example.com/',game,{name:'ALICE',score:123});
    const valid=readChallenge(url,games);assert.equal(valid.score,123);
    for (const extra of [{game:'unknown'},{v:2},{difficulty:'script'},{score:-1},{score:1.5},
        {score:Number.MAX_SAFE_INTEGER+1},{name:'<img>'},{name:12345}]) {
        const bad=new URL(url);bad.hash='arcade?'+new URLSearchParams({challenge:JSON.stringify({...valid,...extra})});
        assert.equal(readChallenge(bad.href,games),null);
    }
    assert.equal(readChallenge('garbage',games),null);
    assert.equal(readChallenge('https://example.com/#arcade?challenge='+encodeURIComponent('x'.repeat(513)),games),null);
    assert.match(compareChallenge(124,valid),/beat ALICE by 1/);
    assert.match(compareChallenge(123,valid),/Matched/);
    assert.match(compareChallenge(0,valid),/leads by 123/);
});

test('friend target persists in a session, stays separate and works with blocked storage',()=>{
    let saved=null;const storage={getItem:()=>saved,setItem:(_,v)=>saved=v,removeItem:()=>saved=null};
    const store=new ChallengeStore(games,storage);
    store.set(readChallenge(challengeLink('https://example.com/',games[0],{name:'BOBBY',score:500}),games));
    const restored=new ChallengeStore(games,storage);assert.equal(restored.target.score,500);
    assert.equal(restored.description().id,games[0].id);
    store.set(null);assert.equal(new ChallengeStore(games,storage).target,null);
    const blocked=new ChallengeStore(games,{getItem(){throw Error();},setItem(){throw Error();}});
    blocked.set(restored.target);assert.equal(blocked.target.name,'BOBBY');
});
