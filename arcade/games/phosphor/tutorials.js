const text=(value,x,y,size=25)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</text>`;
const frame=content=>`<svg viewBox="0 0 400 180" class="guide-art phosphor-diagram" aria-hidden="true">${content}</svg>`;
const ship=(x,y)=>`<path d="M${x-23} ${y}h46v10h-46zM${x-6} ${y}v-13h12v13"/>`;
const alien=(x,y)=>`<path d="M${x-20} ${y-10}h40v20h-40zM${x-28} ${y}v20m56-20v20"/>`;
const lander=(x,y)=>`<path d="M${x-17} ${y-14}h34l9 24h-52zM${x-18} ${y+10}l-14 17h-10m60-17 14 17h10"/>`;
const lift=(x,action)=>`<g class="phosphor-lift"><path d="M${x-15} 65v-27q0-7 6-7h19q6 0 6 7v28l-7 18h-16zM${x-3} 31V14m-7 9 7-9 7 9"/>${text(action,x,119,25)}</g>`;

export const phosphorDiagrams={
    invaders:[
        frame(lift(95,'L: LEFT')+lift(305,'R: RIGHT')+ship(200,152)+'<path d="M165 156h-43m10-8-10 8 10 8M235 156h43m-10-8 10 8-10 8"/>'),
        frame(alien(110,30)+alien(290,30)+ship(200,149)+'<path class="phosphor-shot" d="M200 128V67"/><path d="M65 112V88h90v24h-24v-10H89v10zM245 112V88h90v24h-24v-10h-42v10z"/>'+text('COVER',110,140,21)+'<path class="danger" d="M290 55v28"/>'+text('!',290,159,27)),
        frame(text('x1',65,55,32)+text('x2',155,55,32)+text('x3',245,55,32)+text('x4',335,55,32)+'<path d="M45 89h310"/>'+text('CLEAN FLEET',135,127,24)+'<path d="M299 101l23 9v25l-23 16-23-16v-25z"/>'+text('+1',299,127,22))
    ],
    lander:[
        frame(lift(95,'L: BRAKE')+lift(305,'R: THRUST')+lander(200,110)+'<path class="phosphor-flame" d="M190 125l10 32 10-32"/>'),
        frame(lander(225,49)+'<path d="M90 151h190M185 52h-75m10-8-10 8 10 8M265 52h75m-10-8 10 8-10 8M185 103v31m-8-8 8 8 8-8"/>'+text('STEP',225,98,22)+text('<=32',185,174,26)),
        frame(text('FUEL',85,35,27)+'<rect x="25" y="57" width="120" height="20"/>'+text('+ POINTS',85,113,22)+lander(285,55)+'<path d="M230 96h110"/>'+text('<=8',285,125,28)+text('x2',285,163,32))
    ],
    snake:[
        frame(lift(90,'L: TURN')+lift(310,'R: TURN')+'<path d="M168 157v-30h64v30M168 127l-8 8m8-8 8 8M232 127l-8 8m8-8 8 8"/>'+text('^',200,171,30)),
        frame(text('o o o',114,110,40)+text('>',220,110,45)+'<rect x="257" y="87" width="38" height="38" class="phosphor-next"/>'+text('+',335,110,45)+text('QUEUE',112,37,25)+text('NEXT',276,153,24)),
        frame(text('+',73,53,48)+text('FAST +40',88,107,24)+text('#',285,53,48)+text('4TH +80',285,107,24)+'<path d="M245 143h80m-64-8-16 8 16 8"/>'+text('TRIM',285,173,22))
    ]
};
export const phosphorCaptions={
    invaders:['Raise L or R to move one lane.','Fire is automatic. Both sides chip the cover.','Chain kills. A clean fleet earns a personal shield.'],
    lander:['Raise L to brake. Raise R to thrust.','Sweep sideways to line up. Land at 32 or less.','Save fuel. Centered landings at 8 or less earn x2.'],
    snake:['Raise L or R to turn relative to the head.','Queue the outlined next cell. Change it before the tick.','Fast signals score more. Every fourth trims the tail.']
};
