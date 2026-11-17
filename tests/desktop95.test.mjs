import test from 'node:test';
import assert from 'node:assert/strict';
import {sort,stack,ski} from '../arcade/games/desktop95.js';
import {seededRandom} from '../arcade/core/random.js';
import {createFileDeck,fileType,knowledge} from '../arcade/games/folder-sort-files.js';
import {GameRunner} from '../arcade/core/runner.js';
import {generatedNameCount,NAME_HISTORY_SIZE,createFilenameGenerator} from '../arcade/games/folder-sort-names.js';
const setup=factory=>{const e={random:seededRandom(32),pace:1,message(){},finished:false,finish(text){e.finished=true;e.result=text;}};return {e,g:factory(e)};};
test('folder sort previews files, rewards a real series, and ignores receipt-time duplicate inputs',()=>{
    const {g}=setup(sort);g.state.lives=2;
    for(let i=0;i<5;i++){g.input({action:g.state.correct});const score=g.state.score;g.input({action:'right'});assert.equal(g.state.score,score);g.update(.5);}
    assert.equal(g.state.sorted,5);assert.equal(g.state.lives,3);assert.equal(g.state.queue.length,2);
});
test('folder sort ends without hands and is deterministic across render-independent runs',()=>{
    for(let repeat=0;repeat<2;repeat++){const {g,e}=setup(sort);for(let i=0;i<1000&&!e.finished;i++)g.update(.05);assert.ok(e.finished);assert.equal(e.result,'Game over');assert.equal(g.state.score,0);}
});
test('window snap restores width, while reversing cannot earn points',()=>{
    const {g}=setup(stack);g.state.x=230;g.input({action:'left'});assert.equal(g.state.score,40);assert.equal(g.state.width,282);
    const n=g.state.layers.length;g.input({action:'right'});assert.equal(g.state.score,40);assert.equal(g.state.layers.length,n);
    g.state.x=650;g.input({action:'left'});assert.equal(g.state.lives,2);assert.equal(g.state.layers.length,n);assert.equal(g.state.perfect,0);
});
test('ski gates always keep adjacent routes and a no-input run eventually loses',()=>{
    const {g,e}=setup(ski);let previous=1;
    for(let frame=0;frame<4000&&!e.finished;frame++){
        g.update(.05);
        for(const gate of g.state.gates){assert.ok(Math.abs(gate.gap-previous)<=1);previous=gate.gap;}
    }
    assert.ok(e.finished);assert.equal(g.state.lives,0);
});

test('small overlaps trim exactly to their support instead of growing beyond it',()=>{
    const {g}=setup(stack);g.state.x=445;g.input({action:'left'});
    assert.equal(g.state.width,50);assert.equal(g.state.layers.at(-1).width,50);
    g.state.x=g.state.layers.at(-1).x+24;g.input({action:'left'});
    assert.equal(g.state.width,62);assert.equal(g.state.score,60,'The entire marked snap band remains valid for a narrow window');
});

test('desktop95 timed actions do not change state while paused or after dispose',()=>{
    for(const factory of [sort,stack,ski]){
        const {g}=setup(factory);g.start();g.update(.3);g.pause();
        const before=structuredClone(g.state);g.input({action:'left'});g.update(2);
        assert.deepEqual(g.state,before);g.resume();g.update(.1);g.dispose();
        const ended=structuredClone(g.state);g.update(2);g.input({action:'right'});assert.deepEqual(g.state,ended);
    }
});

test('file types unlock progressively and each deck balances media against text',()=>{
    for(const [sorted,allowed] of [[0,['txt','png']],[5,['txt','png','jpg','gif','bmp','md','rtf']]]){
        const draw=createFileDeck(seededRandom(23)),seen=new Set();
        for(let i=0;i<100;i+=2){
            const pair=[draw(sorted),draw(sorted)];
            assert.notEqual(fileType(pair[0]).category,fileType(pair[1]).category);
            pair.forEach(file=>{const ext=file.split('.').at(-1);assert.ok(allowed.includes(ext));seen.add(ext);});
        }
        assert.deepEqual([...seen].sort(),allowed.sort());
    }
    const draw=createFileDeck(seededRandom(7));
    for(const [milestone,formats] of [[15,['js','py','wav','mp3']],[25,['mp4','webm','json','css']],[35,['cpp','rs','flac','mkv']],[45,['sh','sql','opus','avif']]]){
        const seen=new Set(Array.from({length:200},()=>draw(milestone).split('.').at(-1)));
        formats.forEach(ext=>assert.ok(seen.has(ext),`${ext} unlocked after ${milestone}`));
    }
});

test('filenames use a large deterministic vocabulary without repeating stems across recent files or unlocks',()=>{
    assert.ok(generatedNameCount>10000);
    for(const seed of [1,32,400]){
        const draw=createFileDeck(seededRandom(seed)),replay=createFileDeck(seededRandom(seed)),history=[];
        for(let i=0;i<1500;i++){
            const sorted=i<300?0:Math.floor((i-300)/3),file=draw(sorted),stem=file.slice(0,file.lastIndexOf('.'));
            assert.equal(file,replay(sorted));assert.ok(fileType(file));
            assert.ok(!history.includes(stem),`Repeated ${stem} within ${NAME_HISTORY_SIZE} draws`);
            history.push(stem);if(history.length>NAME_HISTORY_SIZE)history.shift();
        }
    }
});

test('folder categories describe their contents rather than teaching PNG and TXT as the only formats',()=>{
    const {g}=setup(sort),labels=[];
    const painter=new Proxy({compact:false,h:420,text(value){labels.push(String(value));}},{get:(p,key)=>p[key]??(()=>{})});
    g.render(painter);
    assert.ok(labels.includes('(pictures, video, sound)'));assert.ok(labels.includes('(message, code, text)'));
    assert.ok(!labels.includes('PNG'));assert.ok(!labels.includes('TXT'));
});

test('joke filenames have one place in the ordinary name bag, with no weighted shortcut',()=>{
    const draw=createFilenameGenerator(seededRandom(32));
    const type={icon:'text',names:['caramel','rockyou','passwords','hello_world']};
    const count=generatedNameCount/5+type.names.length;
    const names=Array.from({length:count},()=>draw('txt',type));
    assert.equal(new Set(names).size,count);
    for(const name of type.names)assert.equal(names.filter(file=>file===`${name}.txt`).length,1);
});

test('Folder Sort replays get fresh files while an explicit seed remains reproducible',()=>{
    for(const explicit of [false,true]){
        const description={engine:'sort',difficulty:'gentle',randomizeReplay:true,...(explicit?{seed:32}:{})};
        const runner=new GameRunner(description,sort),opening=[runner.game.state.file,...runner.game.state.queue];
        runner.restart();const next=[runner.game.state.file,...runner.game.state.queue];
        if(explicit)assert.deepEqual(next,opening);else assert.notDeepEqual(next,opening);
        runner.dispose();
    }
});

test('sort keeps the first five files simple, grows its multiplier and resets only the chain on a mistake',()=>{
    const {g}=setup(sort);
    for(let i=0;i<16;i++){
        if(i<5)for(const file of [g.state.file,...g.state.queue])assert.match(file,/\.(txt|png)$/);
        g.input({action:g.state.correct});g.update(.5);
    }
    assert.equal(g.state.level,2);assert.equal(knowledge(g.state.streak).title,'Developer');
    assert.equal(knowledge(10).multiplier,3);assert.equal(knowledge(40).title,'Hacker');
    const score=g.state.score;
    g.input({action:g.state.correct==='left'?'right':'left'});
    assert.equal(g.state.score,score);assert.equal(g.state.streak,0);
    assert.equal(knowledge(g.state.streak).multiplier,1);assert.equal(g.state.level,2);
});

test('the real ski runner increases gate speed and frequency over time in both difficulties',()=>{
    for(const difficulty of ['gentle','standard']){
        let now=0,earlySpeed,lateSpeed,firstInterval,lastInterval;
        const runner=new GameRunner({engine:'ski',difficulty,seed:32},ski,{clock:()=>now});runner.play();
        for(let i=0;i<7500;i++){
            const s=runner.game.state,gate=s.gates.find(g=>!g.passed);
            if(gate)s.lane=gate.gap; // Perfect routing isolates world pressure from player mistakes.
            const y=gate?.y,next=s.nextGate;now+=16;runner.step(now);
            if(gate&&s.time>1){const speed=(gate.y-y)/.016;earlySpeed??=speed;if(s.time>90)lateSpeed=speed;}
            if(s.nextGate!==next){firstInterval??=s.nextGate-s.time;lastInterval=s.nextGate-s.time;}
        }
        assert.equal(runner.phase,'playing');assert.ok(lateSpeed>earlySpeed*1.4);
        assert.ok(lastInterval<firstInterval);runner.dispose();
    }
});
