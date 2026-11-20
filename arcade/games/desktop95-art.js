// Windows 95 materials drawn at logical width 720 with a responsive height; no image or camera lifecycle.
// The classic scheme stays light in both appearance modes (see the theme chart). Every animation here
// runs on simulation time, consumes no gameplay RNG and is skipped for reduced motion.
export const C = { face:'#c0c0c0', light:'#ffffff', hilite:'#dfdfdf', shadow:'#808080', dark:'#000000', blue:'#000080', teal:'#008080' };

const ctx = p => (p.c && typeof p.c.fillText === 'function' ? p.c : null);
/** Text in the bundled W95FA face; bold where the shell used bold (captions, Start). */
export function label(p,text,x,y,size,color=C.dark,align='left',bold=false) {
    const c=ctx(p);
    if(!c||!bold){p.text(text,x,y,size,color,align);return;}
    c.save();c.font=`bold ${size}px ${p.colors?.font||'W95FA, sans-serif'}`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';
    c.fillText(String(text),x,y);c.restore();
}
const width = (p,text,size) => { const c=ctx(p); if(c){c.save();c.font=`${size}px ${p.colors?.font||'sans-serif'}`;const w=c.measureText(String(text))?.width;c.restore();if(Number.isFinite(w))return w;} return String(text).length*size*.5; };

/** Pixel-exact two-step bevel: white/light outer-inner edges against black/gray, or the reverse when sunken. */
export function bevel(p,x,y,w,h,sunken=false,face=C.face) {
    const t=p.compact?2.5:1.5;
    p.rect(x,y,w,h,face);
    const [outerA,innerA,outerB,innerB]=sunken?[C.shadow,C.dark,C.light,C.hilite]:[C.light,C.hilite,C.dark,C.shadow];
    p.rect(x,y,w,t,outerA);p.rect(x,y,t,h,outerA);
    p.rect(x,y+h-t,w,t,outerB);p.rect(x+w-t,y,t,h,outerB);
    p.rect(x+t,y+t,w-t*2,t,innerA);p.rect(x+t,y+t,t,h-t*2,innerA);
    p.rect(x+t,y+h-t*2,w-t*2,t,innerB);p.rect(x+w-t*2,y+t,t,h-t*2,innerB);
}

/** Small four-pane flag for the Start button and the caption icon (an original pixel drawing). */
export function flag(p,x,y,s=1) {
    const panes=[['#ff0000',0,0],['#00a000',1,0],['#0000ff',0,1],['#ffff00',1,1]];
    for(const [color,i,j] of panes)p.rect(x+i*7*s+j*1.5*s,y+j*6*s-i*1.5*s,6*s,5*s,color);
}

/** Win95 "exploding window": caption-sized outlines zoom from the taskbar button to the window. */
export function zoomRects(p,from,to,age,reduced=false,duration=.34) {
    if(reduced||age<0||age>duration)return;
    const ease=t=>1-Math.pow(1-t,3);
    for(const lag of [.1,.05,0]){
        const t=ease(Math.max(0,Math.min(1,(age-lag)/(duration-.1))));
        const box=from.map((v,i)=>v+(to[i]-v)*t);
        p.line([[box[0],box[1]],[box[0]+box[2],box[1]],[box[0]+box[2],box[1]+box[3]],[box[0],box[1]+box[3]],[box[0],box[1]]],lag?C.shadow:C.dark,p.compact?3:2,[3,3]);
    }
}

/** Dotted drag outline, as the shell drew while moving an icon. */
export function dragOutline(p,x,y,w,h) {
    p.line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],C.dark,p.compact?2.5:1.5,[2,2]);
}

/** 11x16 pixel hourglass (original drawing), shown while the program is busy. */
const GLASS=['###########','#.........#','.#.......#.','.#.#####.#.','..#.###.#..','...#.#.#...','....#.#....','.....#.....','....#.#....','...#..#.#..','..#...#..#.','.#..#####.#','.#.#######.','#.........#','###########'];
export function hourglass(p,x,y,pixel=2) {
    const left=x-GLASS[0].length*pixel/2,top=y-GLASS.length*pixel/2;
    GLASS.forEach((row,j)=>{for(let i=0;i<row.length;i++){
        if(row[i]==='#')p.rect(left+i*pixel,top+j*pixel,pixel,pixel,C.dark);
        else if(j>0&&j<GLASS.length-1&&row.slice(0,i).includes('#')&&row.slice(i+1).includes('#'))p.rect(left+i*pixel,top+j*pixel,pixel,pixel,C.light);
    }});
}

/** Classic message box with a pop-in (exponential ease, .14 s); reduced motion shows it at full size. */
export function dialog(p,cx,cy,w,h,title,message,{icon='error',age=1,reduced=false}={}) {
    const grow=reduced?1:.55+.45*(1-Math.exp(-Math.max(0,age)/.04));
    const width=w*grow,height=h*grow,x=cx-width/2,y=cy-height/2,compact=p.compact;
    p.rect(x+4,y+4,width,height,'#00000055');
    bevel(p,x,y,width,height);
    const bar=compact?34:22;
    p.rect(x+4,y+4,width-8,bar,C.blue);
    if(grow<.98)return;
    label(p,title,x+10,y+4+bar/2,compact?28:14,C.light,'left',true);
    const iconX=x+(compact?34:24),iconY=y+bar+(height-bar)/2;
    if(icon==='error'){p.circle(iconX,iconY,compact?19:12,'#ff0000');p.line([[iconX-6,iconY-6],[iconX+6,iconY+6]],C.light,3);p.line([[iconX+6,iconY-6],[iconX-6,iconY+6]],C.light,3);}
    else {p.circle(iconX,iconY,compact?19:12,C.light);p.circle(iconX,iconY,compact?19:12,C.blue,false);label(p,'i',iconX,iconY+1,compact?28:17,C.blue,'center',true);}
    p.text(message,iconX+(compact?28:20),iconY,compact?28:15,C.dark);
}

/** The program window: caption, menu, client area (drawn by the game), status bar and taskbar.
 * Neither the game title nor score/lives are repeated: the room header and HUD already show them. */
export function window95(p,caption,status,right='',time=0,reduced=false) {
    const compact=p.compact,bar=compact?38:24,taskbar=compact?44:30;
    p.rect(0,0,720,p.h,C.teal);
    bevel(p,12,10,696,p.h-18-taskbar);
    p.rect(16,14,688,bar,C.blue);
    flag(p,24,14+bar/2-(compact?8:5),compact?1.4:.9);
    label(p,caption,compact?52:42,14+bar/2,compact?28:16,C.light,'left',true);
    const button=compact?30:18;
    [['_',3],['□',2],['×',1]].forEach(([glyph,i])=>{
        const bx=704-4-i*(button+3)-(i===1?0:0),by=14+(bar-button)/2;
        bevel(p,bx,by,button,button-2);p.text(glyph,bx+button/2,by+button/2-1,compact?24:13,C.dark,'center');
    });
    const menuY=14+bar+(compact?16:11),menuSize=compact?26:14;
    let menuX=28;
    for(const item of ['File','Edit','View','Help']){
        p.text(item,menuX,menuY,menuSize,C.dark);
        // Accelerator underline under the first letter.
        p.rect(menuX,menuY+menuSize*.48,width(p,item[0],menuSize),compact?2:1,C.dark);
        menuX+=width(p,item,menuSize)+(compact?26:18);
    }
    const statusY=p.h-taskbar-(compact?52:36),statusH=compact?36:22;
    bevel(p,20,statusY,right?500:680,statusH,true);p.text(status,30,statusY+statusH/2,compact?26:14,C.dark);
    if(right){bevel(p,524,statusY,176,statusH,true);p.text(right,534,statusY+statusH/2,compact?26:14,C.dark);}
    // Taskbar: Start, the active task (pressed) and the tray clock.
    const ty=p.h-taskbar;
    bevel(p,0,ty,720,taskbar);
    const startW=compact?118:72;
    bevel(p,4,ty+4,startW,taskbar-8);flag(p,11,ty+taskbar/2-(compact?7:5),compact?1.2:.8);
    label(p,'Start',compact?38:27,ty+taskbar/2,compact?26:13,C.dark,'left',true);
    bevel(p,startW+10,ty+4,compact?300:220,taskbar-8,true,'#d4d4d4');
    p.text(caption,startW+20,ty+taskbar/2,compact?22:12,C.dark);
    const clockW=compact?118:76;
    bevel(p,716-clockW,ty+4,clockW,taskbar-8,true);
    const minutes=Math.floor(time/60);
    p.text(`10:${String(minutes%60).padStart(2,'0')} AM`,716-clockW/2,ty+taskbar/2,compact?22:12,C.dark,'center');
    if(time<.4)zoomRects(p,[startW+10,ty+4,compact?300:220,taskbar-8],[16,14,688,bar],time,reduced);
    return {top:14+bar+(compact?34:24),bottom:statusY-4};
}
export function folder(p,x,y,text,selected=false,size=1,open=0) {
    p.rect(x-48*size,y-25*size,42*size,15*size,'#d5a330');
    p.rect(x-48*size,y-12*size,96*size,56*size,selected?'#ffe584':'#e8bf53');
    p.outline(x-48*size,y-12*size,96*size,56*size,'#805e12',1);p.line([[x-44*size,y-7*size],[x+44*size,y-7*size]],'#fff0ae',2);
    if(open>0){
        // The front flap swings down when a file lands in the folder.
        const drop=14*size*open;
        p.line([[x-48*size,y+2*size+drop],[x+48*size,y+2*size+drop]],'#805e12',2);
        p.rect(x-46*size,y-10*size,92*size,10*size+drop,'#fff3c4');
    }
    p.text(text,x,y+64*size,p.compact?30:17,C.dark,'center');
}
export function fileIcon(p,x,y,kind,size=1) {
    const w=54*size,h=64*size,ear=13*size;
    p.rect(x-w/2,y,w-ear,h,'#fff');p.rect(x-w/2,y+ear,w,h-ear,'#fff');
    p.line([[x-w/2,y],[x+w/2-ear,y],[x+w/2,y+ear],[x+w/2,y+h],[x-w/2,y+h],[x-w/2,y]],C.dark,1);
    p.line([[x+w/2-ear,y],[x+w/2-ear,y+ear],[x+w/2,y+ear]],C.shadow,1);
    if(kind==='image') {p.rect(x-w/2+8*size,y+15*size,w-16*size,35*size,'#00ffff');p.circle(x+10*size,y+24*size,5*size,'#ffff00');p.line([[x-18*size,y+46*size],[x-4*size,y+29*size],[x+6*size,y+40*size],[x+17*size,y+35*size]],'#008000',4*size);}
    else if(kind==='audio') {p.text('♫',x,y+35*size,34*size,C.blue,'center');}
    else if(kind==='video') {p.rect(x-19*size,y+15*size,38*size,34*size,C.dark);for(let i=0;i<4;i++){p.rect(x-17*size,y+(17+i*8)*size,3*size,4*size,C.light);p.rect(x+14*size,y+(17+i*8)*size,3*size,4*size,C.light);}p.text('>',x,y+32*size,24*size,C.light,'center');}
    else if(kind==='code') {p.text('{ }',x,y+34*size,23*size,C.blue,'center');}
    // Unknown until it is sorted: a blank page, so only the extension tells the folder.
    else if(kind==='unknown') {p.text('?',x,y+36*size,30*size,C.shadow,'center');}
    else for(let i=0;i<4;i++)p.line([[x-w/2+9*size,y+(18+i*9)*size],[x+w/2-9*size,y+(18+i*9)*size]],i===0?C.blue:'#777',2*size);
}
export function tree(p,x,y,size=1,sway=0) {
    p.rect(x-3*size,y+16*size,6*size,16*size,'#74542f');
    for(const [dy,w] of [[10,24],[0,19],[-10,13]]) p.line([[x-w*size+sway,y+(dy+12)*size],[x+sway*1.5,y+(dy-12)*size],[x+w*size+sway,y+(dy+12)*size],[x-w*size+sway,y+(dy+12)*size]],'#176a49',6*size);
    p.line([[x-10*size+sway,y-4*size],[x+sway*1.5,y-21*size],[x+10*size+sway,y-4*size]],'#dff3ee',3*size);
}
