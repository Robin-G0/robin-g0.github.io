// Windows 95 materials drawn at logical width 720 with a responsive height; no image or camera lifecycle.
export const C = { face:'#c0c0c0', light:'#ffffff', shadow:'#808080', dark:'#000000', blue:'#000080', teal:'#008080' };
export function bevel(p,x,y,w,h,sunken=false) {
    p.rect(x,y,w,h,C.face);
    p.line([[x,y+h],[x,y],[x+w,y]],sunken?C.shadow:C.light,2);
    p.line([[x+w,y],[x+w,y+h],[x,y+h]],sunken?C.light:C.dark,2);
}
export function window95(p,title,status,score,lives) {
    const compact=p.compact;
    p.rect(0,0,720,p.h,C.teal);bevel(p,12,10,696,p.h-48);
    p.rect(16,14,688,compact?38:28,C.blue);p.text(title,28,compact?34:28,compact?27:17,'#fff');
    for(const [x,label] of [[640,'_'],[661,'\u25a1'],[682,'\u00d7']]) {bevel(p,x,18,18,18);p.text(label,x+9,27,13,C.dark,'center');}
    p.text('File   Game   Help',28,compact?66:57,compact?22:14,C.dark);
    bevel(p,20,p.h-71,680,26,true);p.text(status,30,p.h-58,compact?22:13,C.dark);
    p.text(`${score} pts   ${'\u2665'.repeat(Math.max(0,lives))}`,685,p.h-58,compact?22:14,C.blue,'right');
    bevel(p,0,p.h-30,720,30);bevel(p,5,p.h-26,75,22);p.text('\u25a3 Start',42,p.h-15,14,C.dark,'center');
    bevel(p,89,p.h-26,200,22,true);p.text(title.split(' \u2014')[0],99,p.h-15,12,C.dark);
    p.text('MOTION ARCADE 95',700,p.h-15,12,C.dark,'right');
}
export function folder(p,x,y,label,selected=false,size=1) {
    p.rect(x-48*size,y-25*size,42*size,15*size,'#d5a330');p.rect(x-48*size,y-12*size,96*size,56*size,selected?'#ffe584':'#e8bf53');
    p.outline(x-48*size,y-12*size,96*size,56*size,'#805e12',1);p.line([[x-44*size,y-7*size],[x+44*size,y-7*size]],'#fff0ae',2);
    p.text(label,x,y+64*size,p.compact?30:17,C.dark,'center');
}
export function fileIcon(p,x,y,kind,size=1) {
    const w=54*size,h=64*size;p.rect(x-w/2,y,w,h,'#fff');p.outline(x-w/2,y,w,h,C.dark,1);
    if(kind==='image') {p.rect(x-w/2+8*size,y+15*size,w-16*size,35*size,'#00ffff');p.circle(x+10*size,y+24*size,5*size,'#ffff00');p.line([[x-18*size,y+46*size],[x-4*size,y+29*size],[x+6*size,y+40*size],[x+17*size,y+35*size]],'#008000',4*size);}
    else if(kind==='audio') {p.text('\u266b',x,y+35*size,34*size,C.blue,'center');}
    else if(kind==='video') {p.rect(x-19*size,y+15*size,38*size,34*size,C.dark);p.text('>',x,y+32*size,24*size,C.light,'center');}
    else if(kind==='code') {p.text('{ }',x,y+34*size,23*size,C.blue,'center');}
    else for(let i=0;i<4;i++)p.line([[x-w/2+9*size,y+(18+i*9)*size],[x+w/2-9*size,y+(18+i*9)*size]],i===0?C.blue:'#777',2*size);
}
export function tree(p,x,y) {
    p.rect(x-3,y+16,6,16,'#74542f');
    for(const [dy,w] of [[10,24],[0,19],[-10,13]]) p.line([[x-w,y+dy+12],[x,y+dy-12],[x+w,y+dy+12],[x-w,y+dy+12]],'#176a49',6);
    p.line([[x-10,y-4],[x,y-21],[x+10,y-4]],'#dff3ee',3);
}
