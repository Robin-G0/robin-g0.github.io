export const CRT = {green:'#65ffab', dim:'#164e34', white:'#d5ffe4', amber:'#ffcf70', dark:'#020b07'};

/** Decoration never consumes gameplay RNG. All coordinates are canvas-local. */
export function terminal(p, title, detail) {
    p.outline(16,12,688,p.h-24,CRT.dim,2);
    p.text(title,32,36,p.compact?32:28,CRT.green);
    p.text(detail,685,36,p.compact?30:25,CRT.white,'right');
    p.line([[30,58],[690,58]],CRT.dim,1);
}
export function stars(p, bottom=p.h-70) {
    for (let i=0;i<32;i++) {
        const x=35+i*173%650,y=75+i*97%Math.max(1,bottom-85);
        p.rect(x,y,i%7?2:4,2,i%5?CRT.dim:CRT.green);
    }
}
export function addBurst(s, text, x, y, good=true) {
    s.bursts.push({text,x,y,good,at:s.time});s.bursts=s.bursts.slice(-6);
}
export function bursts(s,p,project=point=>point,reduced=false) {
    for (const burst of s.bursts) {
        const age=s.time-burst.at;if(age>1.1)continue;
        const {x,y}=project(burst),color=burst.good?CRT.white:CRT.amber;
        p.text(burst.text,x,y-(reduced?0:age*18),30,color,'center');
    }
}
export function pruneBursts(s) {s.bursts=s.bursts.filter(b=>s.time-b.at<1.1);}
export function meter(p,x,y,width,fraction,color=CRT.green) {
    p.outline(x,y,width,14,CRT.dim,2);
    p.rect(x+3,y+3,Math.max(0,Math.min(1,fraction))*(width-6),8,color);
}
export function loseLife(s,env) {
    s.lives=Math.max(0,s.lives-1);env.sound?.({kind:'miss'});
    if(!s.lives){s.ended=true;env.finish('Game over');}
}
