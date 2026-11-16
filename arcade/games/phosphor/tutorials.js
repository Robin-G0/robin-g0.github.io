const text=(value,x,y,size=25)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</text>`;
const frame=content=>`<svg viewBox="0 0 400 180" class="guide-art phosphor-diagram" aria-hidden="true">${content}</svg>`;
const ship=(x,y)=>`<path d="M${x-23} ${y}h46v10h-46zM${x-6} ${y}v-13h12v13"/>`;
const alien=(x,y)=>`<path d="M${x-20} ${y-10}h40v20h-40zM${x-28} ${y}v20m56-20v20"/>`;
const lander=(x,y)=>`<path d="M${x-17} ${y-14}h34l9 24h-52zM${x-18} ${y+10}l-14 17h-10m60-17 14 17h10"/>`;
const lift=(x,action)=>`<g class="phosphor-lift"><path d="M${x-15} 65v-27q0-7 6-7h19q6 0 6 7v28l-7 18h-16zM${x-3} 31V14m-7 9 7-9 7 9"/>${text(action,x,119,25)}</g>`;

export const phosphorDiagrams={
    invaders:[
        frame(lift(95,'L: LEFT')+lift(305,'R: RIGHT')+ship(200,152)+'<path d="M165 156h-43m10-8-10 8 10 8M235 156h43m-10-8 10 8-10 8"/>'),
        frame(alien(110,40)+alien(200,40)+alien(290,40)+ship(110,149)+'<path class="phosphor-shot" d="M110 128V77"/>'+text('AUTO',110,106,20)+'<path class="danger" d="M290 72v75"/>'+text('!',290,170,27)),
        frame(text('x1',65,55,32)+text('x2',155,55,32)+text('x3',245,55,32)+text('x4',335,55,32)+'<path d="M45 89h310"/>'+text('CLEAN FLEET',135,127,24)+'<path d="M299 101l23 9v25l-23 16-23-16v-25z"/>'+text('+1',299,127,22))
    ],
    lander:[
        frame(lift(95,'L: THRUST')+lift(305,'R: BRAKE')+lander(200,110)+'<path class="phosphor-flame" d="M190 125l10 32 10-32"/>'),
        frame(lander(105,45)+lander(290,113)+'<path d="M55 151h100M240 151h100M105 94v38m-8-8 8 8 8-8"/>'+text('FAST',105,172,23)+text('<=32',290,172,26)),
        frame(text('FUEL',85,35,27)+'<rect x="25" y="57" width="120" height="20"/>'+text('+ POINTS',85,113,22)+lander(285,55)+'<path d="M230 96h110"/>'+text('<=8',285,125,28)+text('x2',285,163,32))
    ],
    snake:[
        frame(lift(90,'L: TURN')+lift(310,'R: TURN')+'<path d="M168 157v-30h64v30M168 127l-8 8m8-8 8 8M232 127l-8 8m8-8 8 8"/>'+text('^',200,171,30)),
        frame('<path d="M74 132h100v-37h80" stroke-width="22"/><rect x="257" y="78" width="38" height="38" class="phosphor-next"/>'+text('+',335,101,45)+text('QUEUE',112,37,25)+text('NEXT',276,144,24)),
        frame(text('+',73,53,48)+text('FAST +40',88,107,24)+text('#',285,53,48)+text('4TH +80',285,107,24)+'<path d="M245 143h80m-64-8-16 8 16 8"/>'+text('TRIM',285,173,22))
    ]
};
export const phosphorCaptions={
    invaders:['Raise L or R to move one lane.','Fire is automatic. Leave the lane marked !.','Chain kills. Clear a fleet for a shield.'],
    lander:['Raise L for thrust. R brakes a fast descent.','Touch down at 32 or less. Brake early.','Save fuel for points. Land at 8 or less for x2.'],
    snake:['Raise L or R to turn relative to the head.','Queue the outlined next cell. Change it before the tick.','Fast signals score more. Every fourth trims the tail.']
};
