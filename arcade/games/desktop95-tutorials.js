const text=(value,x,y,size=27)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${value}</text>`;
const frame=content=>`<svg viewBox="0 0 400 180" class="guide-art desktop95-diagram" aria-hidden="true">${content}</svg>`;
const folder=(x,y)=>`<path style="fill:#edc75b;stroke:#80600c" d="M${x-43} ${y-21}h34l10 10h42v48h-86z"/>`;
const window=(x,y,width=120)=>`<rect x="${x}" y="${y}" width="${width}" height="48" style="fill:#c0c0c0;stroke:#000000"/><rect x="${x+4}" y="${y+4}" width="${width-8}" height="15" style="fill:#000080"/>`;

export const desktop95Diagrams={
    sort:[
        frame(folder(90,45)+folder(310,45)+text('L \u2191',90,113,35)+text('R \u2191',310,113,35)+text('MEDIA',90,147,25)+text('TEXT',310,147,25)+text('(pictures, video, sound)',90,174,13)+text('(message, code, text)',310,174,13)),
        frame(text('PNG',65,44,30)+text('TXT',200,44,30)+text('JPG',335,44,30)+folder(110,106)+folder(290,106)+'<path d="M65 58l45 27M200 58l90 27M335 58L110 85"/>'),
        frame(text('KNOWLEDGE',200,32,29)+'<rect x="45" y="54" width="310" height="25" style="fill:#c0c0c0;stroke:#808080"/><path style="stroke:#000080;stroke-width:17;stroke-dasharray:10 3" d="M50 66h205"/>'+text('USER > HACKER',200,110,27)+text('CHAIN = x2 ... x8',200,152,30))
    ],
    stack:[
        frame(window(140,50)+text('L \u2193 DROP',100,148,25)+text('R \u2194',307,148,28)+'<path d="M115 73H55m12-9-12 9 12 9M285 73h60m-12-9 12 9-12 9"/>'),
        frame('<rect x="174" y="35" width="52" height="103" style="fill:#b9ead8;stroke:#176a49"/>'+window(130,76,140)+'<path d="M200 30v27m-8-8 8 8 8-8"/>'+text('SNAP ZONE',200,169,27)),
        frame(text('SNAP +40',113,55,29)+text('TRIM +20',293,55,29)+text('4 SNAPS',113,115,26)+text('+1 \u2665',293,115,37))
    ],
    ski:[
        frame('<path d="M120 20v135M280 20v135"/>'+text('L \u2191',75,92,29)+text('R \u2191',325,92,29)+text('\u2190   \u2192',200,97,30)),
        frame('<path style="stroke:#bc2525;stroke-width:5" d="M151 38v87M249 38v87"/><path class="guide-band" d="M40 137h320"/>'+text('\u2193',200,83,45)+text('PASS THE POLES',200,171,27)),
        frame(text('5 CLEAN',200,49,34)+text('+50',200,105,48)+text('3 HITS = GAME OVER',200,166,23))
    ]
};
export const desktop95Captions={
    sort:['Raise L for media. R for text or code.','Start with TXT / PNG. More formats after 5 and 15.','Keep your chain: up to x8. Every 5 restores a heart.'],
    stack:['Raise L to place. R reverses the slide.','Drop the center pointer inside the green band.','Snaps score more. Four restore a heart.'],
    ski:['Raise L or R to change one lane.','Pass the red poles at the dashed line.','Five clean gates give a bonus. Avoid trees.']
};
