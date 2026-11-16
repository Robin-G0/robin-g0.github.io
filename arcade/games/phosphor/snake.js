import {game} from '../../core/game.js';
import {integer} from '../../core/random.js';
import {CRT,terminal,meter,addBurst,bursts,pruneBursts,loseLife} from './display.js';

export const SNAKE={columns:12,rows:9,quickSeconds:6,minStep:.7};
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
const arrows=['>','v','<','^'];
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
                loseLife(s,env);addBurst(s,'COLLISION',6,4,false);
                s.body=openingBody();s.direction=0;food();
                s.nextStep=s.time+1.3;s.stepStarted=s.time;s.recoveryUntil=s.nextStep;return;
            }
            s.body.unshift({x:next.x,y:next.y});
            if(eating){
                s.eaten++;const quick=s.time-s.foodAt<=SNAKE.quickSeconds;
                const cache=s.eaten%4===0,points=(quick?40:20)+(cache?80:0);
                s.score+=points;
                if(cache && s.body.length>4)s.body.splice(-2);
                addBurst(s,cache?`CACHE +${points}`:`+${points}`,s.food.x,s.food.y);
                env.sound?.({kind:cache?'powerup':'clear',count:quick?2:1});food();
            }else s.body.pop();
        },
        render(s,p) {
            terminal(p,'ASCII SNAKE',`CACHE ${s.eaten%4}/4`);
            const cell=Math.min(52,(p.h-144)/SNAKE.rows),width=cell*SNAKE.columns,height=cell*SNAKE.rows;
            const left=(720-width)/2,top=72+(p.h-144-height)/2;
            const position=point=>({x:left+(point.x+.5)*cell,y:top+(point.y+.5)*cell});
            p.outline(left-3,top-3,width+6,height+6,CRT.green,2);
            for(let x=1;x<SNAKE.columns;x++)p.line([[left+x*cell,top],[left+x*cell,top+height]],CRT.dim,1);
            for(let y=1;y<SNAKE.rows;y++)p.line([[left,top+y*cell],[left+width,top+y*cell]],CRT.dim,1);
            const quick=s.time-s.foodAt<=SNAKE.quickSeconds;
            const target=position(s.food),cache=s.eaten%4===3;
            p.text(cache?'#':'+',target.x,target.y,cell*.95,cache?CRT.amber:CRT.white,'center');
            if(quick)meter(p,target.x-cell*.34,target.y+cell*.28,cell*.68,1-(s.time-s.foodAt)/SNAKE.quickSeconds,CRT.amber);
            s.body.forEach((part,index)=>{
                const {x,y}=position(part),pulse=index===0&&s.time-s.queuedAt<.25;
                p.rect(x-cell*.39,y-cell*.39,cell*.78,cell*.78,index===0?CRT.white:index%2?CRT.green:'#39bc7a');
                if(index===0)p.text(arrows[s.direction],x,y,cell*.77,pulse?CRT.green:CRT.dark,'center');
            });
            const next=nextSnakeCell(s),head=position(s.body[0]);
            if(next.x>=0&&next.x<12&&next.y>=0&&next.y<9){
                const ghost=position(next);
                p.outline(ghost.x-cell*.42,ghost.y-cell*.42,cell*.84,cell*.84,s.turn==null?CRT.dim:CRT.white,3);
                p.line([[head.x,head.y],[ghost.x,ghost.y]],CRT.white,2,[3,5]);
            }
            const arrow=arrows[next.direction];
            p.text(`NEXT ${arrow}`,35,p.h-35,28,s.turn==null?CRT.green:CRT.white);
            meter(p,210,p.h-42,270,Math.max(0,(s.nextStep-s.time)/(s.nextStep-s.stepStarted)));
            p.text(quick?'FAST +40':'+20',682,p.h-35,25,quick?CRT.amber:CRT.green,'right');
            bursts(s,p,b=>position(b),env.reducedMotion);
        }
    });
}
