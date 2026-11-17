import { PRESSURE_RULES } from './pressure.js';
import {phosphorDiagrams,phosphorCaptions} from '../games/phosphor/tutorials.js?v=phosphor-33';
import {desktop95Diagrams,desktop95Captions} from '../games/desktop95-tutorials.js?v=desktop95-5';

const art = name => new URL(`../../assets/art/${name}`,import.meta.url).href;
const handPath = 'M27 44V20c0-5 7-5 7 0v13V9c0-5 7-5 7 0v24V6c0-5 7-5 7 0v27V13c0-5 7-5 7 0v31l7-9c4-5 10-1 7 4L56 61c-4 7-10 11-18 11-11 0-18-7-20-17l-4-15c-1-6 7-8 9-2z';
export const wavingHand = `<svg class="start-hand" viewBox="0 0 80 80" aria-hidden="true"><path d="${handPath}"/><path class="wave-stroke" d="M7 18Q2 29 8 37M64 7q12 7 11 21"/></svg>`;
export function greetingHand(theme) {
    return theme === 'desktop95'
        ? `<img class="start-hand desktop95-hand" src="${art('desktop95-link-hand.svg')}" alt="" aria-hidden="true" width="32" height="32">`
        : wavingHand;
}
const frame = content => `<svg viewBox="0 0 400 180" class="guide-art" aria-hidden="true">${content}</svg>`;
const label = (text,x,y,size=23) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${text}</text>`;
const image = (file,x,y,size=64,css='') => `<image href="${art(file)}" x="${x}" y="${y}" width="${size}" height="${size}" class="${css}"/>`;

function controls(directions) {
    return frame([75,270].map((x,i)=>`<g class="guide-raise" style="--delay:${i*.2}s" transform="translate(${x} 16)"><path d="${handPath}" class="guide-hand"/></g>`+
        label(i?'R':'L',x+39,139,32)+label(directions?'\u2190 \u2191 \u2192':'\u2191',x+39,174,28)).join(''));
}
const diagrams = {
    ...desktop95Diagrams,
    ...phosphorDiagrams,
    popups: [controls(true),frame([90,250].map((x,i)=>[0,1,2].map(n=>
        `<g class="${i?'':'guide-clear'}"><rect x="${x}" y="${123-n*35}" width="70" height="30" rx="2"/>${label(i?'\u2192':'\u2190',x+35,147-n*35,29)}</g>`).join('')).join('')+label('+90',125,35,31)),
        frame('<path d="M35 35H365" class="danger"/>'+label('TOP',200,25,18)+
            '<g class="guide-clear"><rect x="70" y="80" width="95" height="65"/>'+label('\u2190 \u2190 \u2190',117,122,27)+'</g>'+label('+90',282,118,43))],
    maze: [controls(false),frame('<g class="guide-memory"><path d="M200 153L110 105 55 55M110 105l45-50M200 153l90-48-45-50M290 105l55-50"/>'+[55,155,245,345].map(x=>`<rect x="${x-12}" y="36" width="24" height="24"/>`).join('')+'</g>'+label('HOME',200,24,23)+label('L',110,125,24)+label('R',290,125,24)+label('START',200,177,20)),
        frame(image('maze-seconds.gif',30,42)+label('+8s',63,145,27)+image('maze-reveal.gif',134,42)+label('PEEK',166,145,23)+image('maze-tax.gif',240,42)+label('\u2212',272,145,29)+label('DIE',357,84,27)+label('4+',357,113,19))],
    juggle: [controls(false),frame('<path d="M28 146H372" class="danger"/><path d="M28 104H372" class="guide-band"/>'+image('juggler-floppy.gif',78,55,90,'guide-bounce')+image('juggler-ball.gif',258,55,90,'guide-bounce')+label('\u00d72',206,137,30)),
        frame(image('juggler-slow.gif',58,36,88)+label('SLOW',103,155,25)+image('juggler-net.gif',252,36,88)+label('SAVE 1',296,155,25))]
};
const captions = {
    ...desktop95Captions,
    ...phosphorCaptions,
    popups:['Each wrist owns one stack. Match its arrow.','One move clears every matching arrow.','Bigger groups score more. Stay below the top.'],
    maze:['Lift L or R. Lower to repeat.','Look. Remember. Choose L or R.','HOME adds time. Avoid penalties and DIE.'],
    juggle:['Lift L or R. Lower to repeat.','Catch inside the band. Touch the line for \u00d72.','Catch gifts for slow time or one rescue.']
};

/** Three in-game cards. No window, recognizer, timers or permanent GIF elements. */
export class GameGuide {
    constructor(element,description,{signal,onDone,drawPreview,getBindings=()=>null}) {
        this.element=element;this.description=description;this.onDone=onDone;this.drawPreview=drawPreview;
        this.getBindings=getBindings;
        element.innerHTML='<div class="guide-heading"><h3>How to play</h3><button type="button" data-guide-skip hidden>Skip</button></div><p class="guide-progress" aria-label="Tutorial progress"><span>1</span><span>2</span><span>3</span></p><figure class="guide-figure"></figure><h4 class="guide-title"></h4><p class="guide-caption"></p><div class="guide-nav"><button type="button" data-guide-back>Back</button><button type="button" class="button primary" data-guide-next>Next</button></div>';
        this.$=selector=>element.querySelector(selector);
        this.$('[data-guide-back]').addEventListener('click',()=>{this.step--;this.render();},{signal});
        this.$('[data-guide-next]').addEventListener('click',()=>{
            if(this.step===2)this.done();else{this.step++;this.render();}
        },{signal});
        this.$('[data-guide-skip]').addEventListener('click',()=>this.done(),{signal});
    }
    open(canSkip=false) {
        this.step=0;this.element.hidden=false;this.$('[data-guide-skip]').hidden=!canSkip;
        this.render();this.$('[data-guide-next]').focus({preventScroll:true});
    }
    render() {
        const {engine,inputScheme,goal}=this.description;
        this.$('.guide-title').textContent=['Your moves','The loop','Score & survive'][this.step];
        this.$('.guide-caption').textContent=captions[engine]?.[this.step] ||
            [inputScheme==='wrist-directions'?'Match an arrow with that wrist.':'Lift L or R. Lower to repeat.',goal,
                PRESSURE_RULES[engine]?.kind==='rounds'?'Score to refill time. Keep your lives.':'Build your score. Pressure rises over time.'][this.step];
        const figure=this.$('.guide-figure');figure.replaceChildren();
        const bindings=this.getBindings();
        if(this.step===0 && bindings){
            const list=document.createElement('dl');list.className='guide-binding-summary';
            for(const [control,name]of Object.entries(bindings)){
                const term=document.createElement('dt'),value=document.createElement('dd');
                term.textContent=control.replaceAll('_',' ');value.textContent=name;list.append(term,value);
            }
            figure.append(list);this.$('.guide-caption').textContent='Use your assigned bindings for these controls.';
        }
        else if(diagrams[engine])figure.innerHTML=diagrams[engine][this.step];
        else if(this.step===1)this.drawPreview(figure);
        else figure.innerHTML=this.step===0?controls(inputScheme==='wrist-directions'):
            frame(label('+ SCORE',200,75,37)+label('\u2665 \u2665 \u2665',200,129,34));
        this.$('[data-guide-back]').disabled=this.step===0;
        this.$('[data-guide-next]').textContent=this.step===2?'Ready':'Next';
        this.$('.guide-heading h3').textContent=`How to play \u00b7 ${this.step+1}/3`;
        this.element.dataset.step=String(this.step+1);
        [...this.element.querySelectorAll('.guide-progress span')].forEach((dot,i)=>{
            if(i===this.step)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');
        });
    }
    hide() {this.element.hidden=true;this.$('.guide-figure').replaceChildren();}
    done() {this.hide();this.onDone();}
    dispose() {this.hide();this.element.replaceChildren();}
}
