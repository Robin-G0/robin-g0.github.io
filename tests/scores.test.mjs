import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreStore, SCORE_KEY } from '../arcade/core/scores.js';
const game={engine:'juggle',difficulty:'gentle'};
function storage(){const data=new Map();return{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};}

test('local arcade scores keep the five best runs, persist five-character names and do not duplicate a rename',()=>{
    const local=storage(),store=new ScoreStore(local,()=>1000);
    for(const score of [40,100,20,90,80,10,60])store.record(game,score);
    assert.deepEqual(store.list(game).map(row=>row.score),[100,90,80,60,40]);
    const id=store.list(game)[0].id;
    assert.equal(store.rename(game,id,'ROBIN'),true);
    assert.equal(store.rename(game,id,'TOOLONG'),false);
    const loaded=new ScoreStore(local);
    assert.equal(loaded.list(game)[0].name,'ROBIN');assert.equal(loaded.list(game).length,5);
    assert.equal(loaded.data.name,'ROBIN');assert.equal(loaded.hasScore(game),true);
});

test('difficulty and imported preset seeds have separate boards',()=>{
    const store=new ScoreStore(storage());store.record(game,100);
    assert.equal(store.hasScore({...game,difficulty:'standard'}),false);
    store.record({...game,imported:true,id:'import-demo',seed:1},500);
    assert.equal(store.hasScore({...game,imported:true,id:'import-demo',seed:2}),false);
    assert.equal(store.list(game)[0].score,100);
});

test('blocked/corrupt storage remains playable and untrusted stored names are rejected',()=>{
    const blocked={getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}};
    const store=new ScoreStore(blocked);const id=store.record(game,0);
    assert.equal(store.saved,false);assert.equal(store.rename(game,id,'ABCDE'),true);
    assert.equal(store.hasScore(game),true);
    const local=storage();local.setItem(SCORE_KEY,JSON.stringify({version:1,games:{'juggle:gentle':[
        {id:'valid',name:'<img>',score:1000,at:0},{id:'ok',name:'ROBIN',score:25,at:0}]}}));
    assert.deepEqual(new ScoreStore(local).list(game).map(row=>row.name),['ROBIN']);
});
