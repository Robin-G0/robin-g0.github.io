import test from 'node:test';
import assert from 'node:assert/strict';
import {invaders} from '../arcade/games/phosphor/invaders.js';
import {lander} from '../arcade/games/phosphor/lander.js';
import {snake} from '../arcade/games/phosphor/snake.js';
import {CRT,tune,mix} from '../arcade/games/phosphor/display.js';
import {seededRandom} from '../arcade/core/random.js';

/** A canvas stand-in that records fills, so tests can see what a frame paints. */
export function recordingPainter(colors={},h=420,compact=false) {
    const fills=[];
    const gradient={addColorStop(){}};
    const context=new Proxy({fills,createRadialGradient:()=>gradient,measureText:text=>({width:String(text).length*12}),
        fillRect(...args){fills.push(['fillRect',this.fillStyle,...args]);},fillText(text){fills.push(['text',this.fillStyle,text]);},
        fill(){fills.push(['fill',this.fillStyle]);},roundRect(){},save(){},restore(){}},{
        get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
    const painter={c:context,colors,w:720,h,compact,
        color:value=>colors[value]||value,
        rect(x,y,w,height,color){context.fillStyle=painter.color(color);context.fills.push(['rect',context.fillStyle,x,y,w,height]);},
        outline(){},line(){},circle(){},text(text,x,y,size,color){context.fills.push(['label',painter.color(color),String(text),x,y,size]);}};
    return painter;
}

function play(factory,reducedMotion,seconds=40) {
    let draws=0;const random=seededRandom(77);
    const env={pace:1,random:()=>{draws++;return random();},reducedMotion,message(){},sound(){},finish(){}};
    const g=factory(env);g.start();const p=recordingPainter({},420),phone=recordingPainter({},740,true);
    for(let frame=0;frame<seconds*30;frame++){
        if(frame%37===0)g.input({action:frame%74?'left':'right'});
        g.update(1/30);
        // Rendering must never draw from the gameplay generator.
        const before=draws;g.render(p);g.render(phone);assert.equal(draws,before,'render consumed gameplay RNG');
    }
    return structuredClone(g.state);
}

for(const [name,factory] of [['invaders',invaders],['lander',lander],['snake',snake]]){
    test(`Phosphor ${name}: decoration and reduced motion leave rules, scores and RNG identical`,()=>{
        const full=play(factory,false),reduced=play(factory,true);
        assert.deepEqual(reduced,full);
    });
}

test('Phosphor canvas takes its tube colours from the theme chart in both appearance modes',()=>{
    const light={theme:'phosphor',bg:'#101709',ink:'#c2fa89',accent:'#b8ff6b',gold:'#efd78c'};
    const dark={theme:'phosphor',bg:'#070d07',ink:'#a5f7a0',accent:'#75f488',gold:'#dfe88a'};
    tune({colors:light});assert.equal(CRT.green,'#b8ff6b');assert.equal(CRT.dark,'#101709');assert.equal(CRT.amber,'#efd78c');
    tune({colors:dark});assert.equal(CRT.green,'#75f488');assert.equal(CRT.dim,mix('#070d07','#75f488',.3));
    tune({colors:{theme:'matrix',accent:'#00ff00',bg:'#000000'}});assert.equal(CRT.green,'#65ffab','other themes keep the base tube');
    const g=invaders({pace:1,random:seededRandom(1),message(){},sound(){},finish(){}});g.start();g.update(.6);
    const p=recordingPainter(dark);g.render(p);
    assert.ok(p.c.fills.some(fill=>fill[1]==='#75f488'),'the fleet is drawn in the dark-mode accent');
    assert.ok(!p.c.fills.some(fill=>fill[0]==='label'&&/INVADERS/.test(fill[2])),'the canvas does not repeat the room title');
});

test('Phosphor phone boards keep status text at a legible logical size',()=>{
    for(const factory of [invaders,lander,snake]){
        const g=factory({pace:1,random:seededRandom(5),message(){},sound(){},finish(){}});g.start();g.update(1);
        const p=recordingPainter({},740,true);g.render(p);
        const labels=p.c.fills.filter(fill=>fill[0]==='label');
        assert.ok(labels.length>2);
        for(const label of labels)assert.ok(label[5]>=28,`${label[2]} is ${label[5]} logical px on a phone`);
    }
});
