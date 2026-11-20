import {game} from '../../core/game.js?v=eras-4';
import {clamp,integer} from '../../core/random.js?v=eras-4';
import {CRT,terminal,stars,addBurst,bursts,pruneBursts,loseLife,bloom,faded,shards,staticBurst,rollBand,warmUp,glass,bitmap} from './display.js?v=eras-4';
import {createBunkers,strikeBunker,crushBunker,drawBunkers} from './bunkers.js?v=eras-4';

export const INVADERS={lanes:7,ground:322,shotSeconds:.48,warningSeconds:.95,hitGrace:1.15};
export const laneX=lane=>72+lane*96;

// Original 11x8 character-cell daemons (two march poses each) and a 13x7 turret.
const ALIENS=[
    [['....###....','..#######..','.##.###.##.','###########','#.#.###.#.#','..#.....#..','.#.#...#.#.','#.........#'],
     ['....###....','..#######..','.##.###.##.','###########','..#.###.#..','.#.#...#.#.','#.........#','.#.......#.']],
    [['...#...#...','....#.#....','..#######..','.###.#.###.','###########','.#.#.#.#.#.','#.#.....#.#','...........'],
     ['...#...#...','....#.#....','..#######..','.###.#.###.','###########','#.#.#.#.#.#','.#.......#.','#.........#']]
];
const SHIP=['......#......','.....###.....','..#..###..#..','.###########.','#############','##.#######.##','#...........#'];

/** Raises move one lane; autofire leaves time to read the threatened lane. */
export function invaders(env) {
    const s={time:0,lane:3,previousLane:3,movedAt:-10,bullets:[],aliens:[],bombs:[],bursts:[],
        wave:0,nextShot:0,nextAttack:3,chain:0,lastKill:-10,shield:false,invulnerableUntil:0,
        breached:0,intermissionUntil:0,ended:false,bunkers:createBunkers()};
    function fleet() {
        s.wave++;s.breached=0;
        s.aliens=Array.from({length:14},(_,id)=>({id,lane:id%7,y:82+Math.floor(id/7)*44}));
        s.nextAttack=s.time+2.4;s.nextShot=s.time+.25;
    }
    function hit() {
        if(s.time<s.invulnerableUntil)return;
        s.invulnerableUntil=s.time+INVADERS.hitGrace;s.chain=0;
        if(s.shield){s.shield=false;env.sound?.({kind:'rescue'});addBurst(s,'SHIELD',laneX(s.lane),280,true,'shield');}
        else {loseLife(s,env);addBurst(s,'HIT',laneX(s.lane),280,false,'hit');}
    }
    fleet();
    return game(s,{
        feedback:()=>({hideAll:true}),
        input(s,event) {
            s.previousLane=s.lane;s.lane=clamp(s.lane+(event.action==='left'?-1:1),0,6);s.movedAt=s.time;
            if(s.lane!==s.previousLane)env.sound?.({kind:'input',action:event.action});
        },
        update(s,dt) {
            pruneBursts(s);if(s.ended)return;
            if(s.intermissionUntil){
                if(s.time>=s.intermissionUntil){s.intermissionUntil=0;fleet();}
                return;
            }
            if(s.time>=s.nextShot){
                s.bullets.push({lane:s.lane,y:314});s.nextShot=s.time+INVADERS.shotSeconds;
            }
            for(const bullet of s.bullets){
                const previous=bullet.y;
                bullet.y-=290*dt;
                if(strikeBunker(s.bunkers,bullet.lane,previous,bullet.y,s.time)){bullet.y=-100;continue;}
                const target=s.aliens.filter(a=>a.lane===bullet.lane && Math.abs(a.y-bullet.y)<22)
                    .sort((a,b)=>b.y-a.y)[0];
                if(!target)continue;
                s.aliens=s.aliens.filter(a=>a!==target);bullet.y=-100;
                s.chain=s.time-s.lastKill<3.5?Math.min(4,s.chain+1):1;s.lastKill=s.time;
                const points=10*s.chain;s.score+=points;addBurst(s,`+${points}`,laneX(target.lane),target.y,true,'kill');
                env.sound?.({kind:'clear',count:s.chain});
            }
            s.bullets=s.bullets.filter(b=>b.y>60).slice(-16);
            const descent=(4+s.wave*1.3)*env.pace;
            for(const alien of s.aliens){
                alien.y+=descent*dt;
                crushBunker(s.bunkers,alien);
                if(alien.y>INVADERS.ground){s.breached++;hit();alien.y=1000;}
            }
            s.aliens=s.aliens.filter(a=>a.y<1000);
            if(s.time>=s.nextAttack && s.aliens.length && s.bombs.length<6){
                const lanes=[...new Set(s.aliens.map(a=>a.lane))];
                const lane=lanes[integer(env.random,0,lanes.length-1)];
                s.bombs.push({lane,y:68,launchAt:s.time+INVADERS.warningSeconds});
                s.nextAttack=s.time+Math.max(.8,3.2-s.wave*.16)/env.pace;
            }
            for(const bomb of s.bombs){
                if(s.time<bomb.launchAt)continue;
                const previous=bomb.y;
                bomb.y+=(78+Math.min(60,s.wave*5))*env.pace*dt;
                if(strikeBunker(s.bunkers,bomb.lane,previous,bomb.y,s.time)){bomb.y=1000;continue;}
                if(bomb.y>=318 && bomb.lane===s.lane){hit();bomb.y=1000;}
            }
            s.bombs=s.bombs.filter(b=>b.y<340);
            if(!s.aliens.length && !s.ended){
                const bonus=s.breached?0:100*s.wave;
                s.score+=bonus;s.shield ||= !s.breached;
                addBurst(s,bonus?`CLEAN +${bonus}`:'NEXT FLEET',360,175);
                if(bonus)env.sound?.({kind:'powerup'});
                s.bombs=[];s.bullets=[];s.intermissionUntil=s.time+1.1;
            }
        },
        render(s,p) {
            const y=value=>76+(value-76)*(p.h-144)/246;
            const reduced=env.reducedMotion,compact=p.compact,px=compact?5:4;
            terminal(p,`WAVE ${s.wave}`,`FLEET ${s.aliens.length}`,s.time,reduced);stars(p,p.h-70,s.time,reduced);
            for(let lane=0;lane<7;lane++)p.line([[laneX(lane),74],[laneX(lane),p.h-66]],CRT.dim,1,[2,14]);
            for(const bomb of s.bombs){
                const bx=laneX(bomb.lane);
                if(s.time<bomb.launchAt){
                    // The warned lane breathes slowly (no strobe) until launch; reduced motion keeps it lit.
                    const glow=reduced?1:.6+.4*Math.cos((bomb.launchAt-s.time)*Math.PI*2.1);
                    faded(p,.08*glow,()=>p.rect(bx-34,80,68,p.h-124,CRT.amber));
                    p.outline(bx-32,p.h-87,64,43,CRT.amber,3);
                    p.text('!',bx,p.h-112,compact?46:37,CRT.amber,'center');
                    p.line([[bx,80],[bx,p.h-120]],CRT.amber,1,[3,13]);
                }else{
                    // Zigzag shot with a short afterglow above it.
                    const by=y(bomb.y),kink=Math.floor(bomb.y/9)%2?4:-4;
                    for(let i=1;i<=3;i++)faded(p,.32-i*.09,()=>p.rect(bx-2,by-12-i*9,4,8,CRT.amber));
                    p.line([[bx-kink,by-11],[bx+kink,by-4],[bx-kink,by+3],[bx+kink,by+10]],CRT.amber,4);
                }
            }
            // Two march poses; the previous pose lingers briefly as phosphor afterglow.
            const pose=reduced?0:Math.floor(s.time*2)%2,sinceStep=s.time*2%1/2;
            for(const a of s.aliens){
                const x=laneX(a.lane),cy=y(a.y),art=ALIENS[a.id<7?0:1];
                if(!reduced&&sinceStep<.28)faded(p,.4*(1-sinceStep/.28),()=>bitmap(p,art[1-pose],x,cy+2,px,CRT.dim));
                bitmap(p,art[pose],x,cy+2,px,CRT.green);
            }
            for(const bullet of s.bullets){
                const bx=laneX(bullet.lane),by=y(bullet.y);
                for(let i=1;i<=3;i++)faded(p,.36-i*.1,()=>p.rect(bx-2,by+6+i*9,4,8,CRT.white));
                p.rect(bx-2,by,4,13,CRT.white);
            }
            drawBunkers(s.bunkers,p,y,s.time);
            const x=laneX(s.lane),shipY=p.h-68,moved=s.time-s.movedAt;
            if(moved<.32&&s.previousLane!==s.lane)faded(p,.55*(1-moved/.32),()=>bitmap(p,SHIP,laneX(s.previousLane),shipY,px,CRT.dim));
            const color=s.time<s.invulnerableUntil?CRT.amber:moved<.24?CRT.white:CRT.green;
            bitmap(p,SHIP,x,shipY,px,color);
            if(s.shield){
                const breathe=reduced?1:.75+.25*Math.sin(s.time*2.4);
                faded(p,breathe,()=>{for(const side of [-1,1])p.line([[x+side*26,shipY-24],[x+side*36,shipY-24],[x+side*36,shipY+22],[x+side*26,shipY+22]],CRT.white,2);});
            }
            for(const burst of s.bursts){
                const age=s.time-burst.at,by=y(burst.y);
                if(burst.kind==='kill'){
                    if(age<.4&&!reduced)bloom(p,burst.x,by,70*(1-Math.pow(1-age/.4,2))+20,CRT.green,.55*(1-age/.4));
                    shards(p,burst.x,by,age,burst.x*7+burst.y,CRT.green,reduced);
                }else if(burst.kind==='hit'){
                    if(!reduced&&age<.5)bloom(p,burst.x,shipY,90,CRT.amber,.5*(1-age/.5));
                    staticBurst(p,burst.x-60,shipY-40,120,70,age,reduced);
                }else if(burst.kind==='shield'&&!reduced&&age<.5)bloom(p,burst.x,shipY,80*(.5+age),CRT.white,.45*(1-age/.5));
            }
            const baseY=p.h-(compact?52:38),labelY=p.h-(compact?28:20),labelSize=compact?42:23;
            p.line([[30,baseY],[690,baseY]],CRT.green,2);
            p.text(s.shield?'SHIELD +1':'AUTO FIRE',34,labelY,labelSize,CRT.green);
            const chain=s.time-s.lastKill<3.5?Math.max(1,s.chain):1;
            p.text(`CHAIN x${chain}`,682,labelY,labelSize,chain>1?CRT.white:CRT.green,'right');
            if(s.intermissionUntil)rollBand(p,1-(s.intermissionUntil-s.time)/1.1,reduced);
            glass(p);
            bursts(s,p,b=>({...b,y:b.kind==='hit'||b.kind==='shield'?shipY-46:y(b.y)}),reduced);
            warmUp(p,s.time,reduced);
        }
    });
}
