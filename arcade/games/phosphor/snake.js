import {game} from '../../core/game.js?v=eras-4';
import {integer} from '../../core/random.js?v=eras-4';
import {CRT,terminal,meter,addBurst,bursts,pruneBursts,loseLife,bloom,faded,staticBurst,warmUp,glass,mix} from './display.js?v=eras-4';

export const SNAKE={columns:12,rows:9,quickSeconds:6,minStep:.7};
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
const arrows=['>','v','<','^'];
export const snakeGlyph=(direction,head=true)=>head?arrows[direction]:'o';
function drawGlyph(p,glyph,x,y,size,color) {
    // Literal ASCII must remain an unmistakable angle/letter, even with a decorative display font.
    const c=p.c;c.save();c.font=`bold ${size}px Consolas, "Lucida Console", monospace`;
    c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(glyph,x,y);c.restore();
}
const openingBody=()=>[{x:5,y:4},{x:4,y:4},{x:3,y:4}];
export function snakeStep(pace,eaten) {return Math.max(SNAKE.minStep,1.35/pace-eaten*.008);}
export function nextSnakeCell(s) {
    const direction=(s.direction+(s.turn||0)+4)%4,[dx,dy]=directions[direction];
    return {x:s.body[0].x+dx,y:s.body[0].y+dy,direction};
}

/** Relative turns are replaceable until the next visible clock tick. */
export function snake(env) {
    const s={body:openingBody(),direction:0,turn:null,nextStep:1.5,stepStarted:0,
        food:{x:8,y:4},foodAt:0,eaten:0,queuedAt:-10,recoveryUntil:0,bursts:[],ended:false};
    // Display-only afterglow of the cells the tail just left; never part of the game state.
    const glow={step:-1,body:[],left:[],at:-10};
    function food() {
        const occupied=new Set(s.body.map(part=>part.y*SNAKE.columns+part.x)),free=[];
        for(let y=0;y<SNAKE.rows;y++)for(let x=0;x<SNAKE.columns;x++)
            if(!occupied.has(y*SNAKE.columns+x))free.push({x,y});
        if(!free.length){s.score+=1000;s.body=openingBody();s.direction=0;return food();}
        s.food=free[integer(env.random,0,free.length-1)];s.foodAt=s.time;
    }
    return game(s,{
        feedback:()=>({hideAll:true}),
        input(s,event) {
            if(s.time<s.recoveryUntil||s.ended)return;
            s.turn=event.action==='left'?-1:1;s.queuedAt=s.time;
            env.sound?.({kind:'turn',action:event.action});
        },
        pause(s){s.turn=null;},
        update(s) {
            pruneBursts(s);if(s.ended||s.time<s.nextStep)return;
            s.recoveryUntil=0;
            s.stepStarted=s.time;s.nextStep=s.time+snakeStep(env.pace,s.eaten);
            const next=nextSnakeCell(s);s.direction=next.direction;s.turn=null;
            const eating=next.x===s.food.x&&next.y===s.food.y;
            const occupied=eating?s.body:s.body.slice(0,-1);
            if(next.x<0||next.x>=SNAKE.columns||next.y<0||next.y>=SNAKE.rows||occupied.some(part=>part.x===next.x&&part.y===next.y)){
                loseLife(s,env);addBurst(s,'COLLISION',6,4,false,'crash');
                s.body=openingBody();s.direction=0;food();
                s.nextStep=s.time+1.3;s.stepStarted=s.time;s.recoveryUntil=s.nextStep;return;
            }
            s.body.unshift({x:next.x,y:next.y});
            if(eating){
                s.eaten++;const quick=s.time-s.foodAt<=SNAKE.quickSeconds;
                const cache=s.eaten%4===0,points=(quick?40:20)+(cache?80:0);
                s.score+=points;
                if(cache && s.body.length>4)s.body.splice(-2);
                addBurst(s,cache?`CACHE +${points}`:`+${points}`,s.food.x,s.food.y,true,'eat');
                env.sound?.({kind:cache?'powerup':'clear',count:quick?2:1});food();
            }else s.body.pop();
        },
        render(s,p) {
            const reduced=env.reducedMotion,compact=p.compact;
            terminal(p,`CACHE ${s.eaten%4}/4`,`LENGTH ${s.body.length}`,s.time,reduced);
            const cell=Math.min(compact?56:52,(p.h-144)/SNAKE.rows),width=cell*SNAKE.columns,height=cell*SNAKE.rows;
            const left=(720-width)/2,top=72+(p.h-144-height)/2;
            const position=point=>({x:left+(point.x+.5)*cell,y:top+(point.y+.5)*cell});
            p.outline(left-3,top-3,width+6,height+6,CRT.green,2);
            for(let x=1;x<SNAKE.columns;x++)p.line([[left+x*cell,top],[left+x*cell,top+height]],CRT.dim,1);
            for(let y=1;y<SNAKE.rows;y++)p.line([[left,top+y*cell],[left+width,top+y*cell]],CRT.dim,1);
            const quick=s.time-s.foodAt<=SNAKE.quickSeconds;
            const target=position(s.food),cache=s.eaten%4===3;
            p.text(cache?'#':'+',target.x,target.y,cell*.95,cache?CRT.amber:CRT.white,'center');
            if(quick)meter(p,target.x-cell*.34,target.y+cell*.28,cell*.68,1-(s.time-s.foodAt)/SNAKE.quickSeconds,CRT.amber);
            if(!reduced&&quick){
                // The fresh signal glows while the fast bonus lasts.
                bloom(p,target.x,target.y,cell*.9,cache?CRT.amber:CRT.green,.22+.1*Math.sin(s.time*3));
            }
            // Afterglow: cells the tail just left keep a fading 'o' for a moment.
            if(s.stepStarted!==glow.step){
                const now=new Set(s.body.map(part=>part.y*SNAKE.columns+part.x));
                glow.left=glow.step<0?[]:glow.body.filter(part=>!now.has(part.y*SNAKE.columns+part.x));
                glow.body=s.body.map(part=>({...part}));glow.step=s.stepStarted;glow.at=s.stepStarted;
            }
            const glowAge=s.time-glow.at;
            if(!reduced&&glowAge>=0&&glowAge<.5)for(const part of glow.left){
                const {x,y}=position(part);
                faded(p,.5*(1-glowAge/.5),()=>drawGlyph(p,'o',x,y,cell*.88,CRT.dim));
            }
            s.body.forEach((part,index)=>{
                const {x,y}=position(part),pulse=index===0&&s.time-s.queuedAt<.25;
                if(index===0)p.outline(x-cell*.43,y-cell*.43,cell*.86,cell*.86,pulse?CRT.white:CRT.green,2);
                // The trace cools toward the tail, like an older phosphor line.
                const tone=index===0?CRT.white:mix(CRT.green,CRT.dim,Math.min(.45,index/Math.max(1,s.body.length-1)*.45));
                drawGlyph(p,snakeGlyph(s.direction,index===0),x,y,cell*.88,tone);
            });
            for(const burst of s.bursts){
                const age=s.time-burst.at,at=position(burst);
                if(burst.kind==='eat'&&!reduced&&age<.5)bloom(p,at.x,at.y,cell*(1+age*3),CRT.white,.5*(1-age/.5));
                if(burst.kind==='crash')staticBurst(p,left,top,width,height,age,reduced,.5);
            }
            const next=nextSnakeCell(s),head=position(s.body[0]);
            if(next.x>=0&&next.x<12&&next.y>=0&&next.y<9){
                const ghost=position(next);
                p.outline(ghost.x-cell*.42,ghost.y-cell*.42,cell*.84,cell*.84,s.turn==null?CRT.dim:CRT.white,3);
                p.line([[head.x,head.y],[ghost.x,ghost.y]],CRT.white,2,[3,5]);
            }
            const arrow=arrows[next.direction];
            const rowY=p.h-(compact?40:35),size=compact?44:28;
            p.text(`NEXT ${arrow}`,35,rowY,size,s.turn==null?CRT.green:CRT.white);
            meter(p,compact?230:210,rowY-(compact?13:7),compact?230:270,Math.max(0,(s.nextStep-s.time)/(s.nextStep-s.stepStarted)),CRT.green,compact?26:14);
            p.text(quick?'FAST +40':'+20',682,rowY,compact?42:25,quick?CRT.amber:CRT.green,'right');
            glass(p);
            bursts(s,p,b=>position(b),reduced);
            warmUp(p,s.time,reduced);
        }
    });
}
