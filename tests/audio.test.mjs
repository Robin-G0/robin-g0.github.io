import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio } from '../arcade/core/audio.js';

test('original sound cues respect mute, voice limits, unavailable audio and disposal', () => {
    let oscillators = 0, closed = 0;
    const parameter = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} };
    const context = { state: 'running', currentTime: 0, destination: {}, resume: async () => {},
        close: async () => { closed++; }, createGain: () => ({ gain: { ...parameter }, connect() {}, disconnect() {} }),
        createOscillator: () => { oscillators++; return { frequency: parameter, connect() {}, disconnect() {}, start() {}, stop() {} }; } };
    const audio = new ArcadeAudio('construction', () => context);
    audio.unlock(); audio.play({ kind: 'clear', count: 8, perfect: true });
    assert.equal(oscillators, 4);
    audio.toggle(); audio.play({ kind: 'clear' }); assert.equal(oscillators, 4);
    audio.toggle(); for (let i = 0; i < 30; i++) audio.play();
    assert.equal(oscillators, 12);
    audio.dispose(); audio.play(); assert.equal(oscillators, 12); assert.equal(closed, 1);
    const unsupported = new ArcadeAudio('glass', () => { throw new Error('No audio'); });
    assert.doesNotThrow(() => { unsupported.unlock(); unsupported.play(); unsupported.dispose(); });
});

test('Juggler catch, edge, gift and miss have distinct short synthesized cues',()=>{
    const cues=[];
    for(const event of [{kind:'bounce'},{kind:'bounce',perfect:true},{kind:'powerup'},{kind:'miss'}]){
        const frequencies=[];
        const parameter={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
        const context={state:'running',currentTime:0,destination:{},resume:async()=>{},close:async()=>{},
            createGain:()=>({gain:parameter,connect(){},disconnect(){}}),
            createOscillator:()=>({frequency:{setValueAtTime:value=>frequencies.push(value)},
                connect(){},disconnect(){},start(){},stop(){}})};
        const audio=new ArcadeAudio('construction',()=>context);audio.unlock();audio.play(event);audio.dispose();
        assert.ok(frequencies.length<=4);cues.push(frequencies);
    }
    assert.equal(new Set(cues.map(cue=>JSON.stringify(cue))).size,4);
});
