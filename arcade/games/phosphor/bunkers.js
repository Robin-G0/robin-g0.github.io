import {CRT,mix} from './display.js';

const MASK=['.#####.','#######','###.###','##...##'];
export const BUNKER={top:265,cellWidth:10,cellHeight:6,health:2};

/** Small fixed grids; health persists across waves and resets with a new run. */
export function createBunkers() {
    return [1,3,5].map(lane=>({lane,cells:MASK.flatMap((row,y)=>[...row].flatMap((value,x)=>
        value==='#'?[{x:72+lane*96-35+x*10,y:BUNKER.top+y*6,hp:BUNKER.health,hitAt:-10}]:[]))}));
}

/** Swept collision prevents fast bullets skipping cover between frames. */
export function strikeBunker(bunkers,lane,from,to,now) {
    const bunker=bunkers.find(b=>b.lane===lane);if(!bunker)return false;
    const x=72+lane*96,low=Math.min(from,to),high=Math.max(from,to),up=to<from;
    let hit=null;
    for(const cell of bunker.cells){
        if(cell.hp<=0||x<cell.x||x>=cell.x+BUNKER.cellWidth||high<cell.y||low>cell.y+BUNKER.cellHeight)continue;
        if(!hit || (up?cell.y>hit.y:cell.y<hit.y))hit=cell;
    }
    if(!hit)return false;
    // One absorbed shot leaves a visible three-cell crater instead of an invisible HP counter.
    for(const cell of bunker.cells)if(cell.y===hit.y&&Math.abs(cell.x-hit.x)<=BUNKER.cellWidth&&cell.hp>0){
        cell.hp--;cell.hitAt=now;
    }
    return true;
}

export function crushBunker(bunkers,alien) {
    if(alien.y+16<BUNKER.top)return;
    const bunker=bunkers.find(b=>b.lane===alien.lane);if(!bunker)return;
    for(const cell of bunker.cells)if(cell.y<=alien.y+16)cell.hp=0;
}

export function drawBunkers(bunkers,p,projectY,time) {
    for(const bunker of bunkers)for(const cell of bunker.cells){
        if(cell.hp<=0)continue;
        const y=projectY(cell.y),height=Math.max(3,projectY(cell.y+BUNKER.cellHeight)-y-1);
        const flash=time-cell.hitAt<.16;
        p.rect(cell.x,y,BUNKER.cellWidth-1,height,flash?CRT.white:cell.hp===BUNKER.health?CRT.green:mix(CRT.green,CRT.dark,.45));
        if(cell.hp<BUNKER.health)p.line([[cell.x+2,y+1],[cell.x+7,y+height-1]],CRT.dark,2);
    }
}
