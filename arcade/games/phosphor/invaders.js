import {game} from '../../core/game.js';
import {clamp,integer} from '../../core/random.js';
import {CRT,terminal,stars,addBurst,bursts,pruneBursts,loseLife} from './display.js';

export const INVADERS={lanes:7,ground:322,shotSeconds:.48,warningSeconds:.95,hitGrace:1.15};
export const laneX=lane=>72+lane*96;

/** Raises move one lane; autofire leaves time to read the threatened lane. */
export function invaders(env) {
    const s={time:0,lane:3,previousLane:3,movedAt:-10,bullets:[],aliens:[],bombs:[],bursts:[],
        wave:0,nextShot:0,nextAttack:3,chain:0,lastKill:-10,shield:false,invulnerableUntil:0,
        breached:0,intermissionUntil:0,ended:false};
    function fleet() {
        s.wave++;s.breached=0;
        s.aliens=Array.from({length:14},(_,id)=>({id,lane:id%7,y:82+Math.floor(id/7)*44}));
        s.nextAttack=s.time+2.4;s.nextShot=s.time+.25;
    }
    function hit() {
        if(s.time<s.invulnerableUntil)return;
        s.invulnerableUntil=s.time+INVADERS.hitGrace;s.chain=0;
        if(s.shield){s.shield=false;env.sound?.({kind:'rescue'});addBurst(s,'SHIELD',laneX(s.lane),280);}
        else {loseLife(s,env);addBurst(s,'HIT',laneX(s.lane),280,false);}
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
                bullet.y-=290*dt;
                const target=s.aliens.filter(a=>a.lane===bullet.lane && Math.abs(a.y-bullet.y)<22)
                    .sort((a,b)=>b.y-a.y)[0];
                if(!target)continue;
                s.aliens=s.aliens.filter(a=>a!==target);bullet.y=-100;
                s.chain=s.time-s.lastKill<3.5?Math.min(4,s.chain+1):1;s.lastKill=s.time;
                const points=10*s.chain;s.score+=points;addBurst(s,`+${points}`,laneX(target.lane),target.y);
                env.sound?.({kind:'clear',count:s.chain});
            }
            s.bullets=s.bullets.filter(b=>b.y>60).slice(-16);
            const descent=(4+s.wave*1.3)*env.pace;
            for(const alien of s.aliens){
                alien.y+=descent*dt;
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
                bomb.y+=(78+Math.min(60,s.wave*5))*env.pace*dt;
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
            terminal(p,'TERMINAL INVADERS',`WAVE ${s.wave}`);stars(p,p.h-70);
            for(let lane=0;lane<7;lane++)p.line([[laneX(lane),74],[laneX(lane),p.h-66]],CRT.dim,1,[2,14]);
            for(const bomb of s.bombs){
                if(s.time<bomb.launchAt){
                    p.outline(laneX(bomb.lane)-32,p.h-87,64,43,CRT.amber,3);
                    p.text('!',laneX(bomb.lane),p.h-112,37,CRT.amber,'center');
                    p.line([[laneX(bomb.lane),80],[laneX(bomb.lane),p.h-120]],CRT.amber,1,[3,13]);
                }else p.line([[laneX(bomb.lane),y(bomb.y)-10],[laneX(bomb.lane),y(bomb.y)+10]],CRT.amber,5);
            }
            for(const a of s.aliens){
                const x=laneX(a.lane),cy=y(a.y),step=env.reducedMotion?0:Math.floor(s.time*2)%2*5;
                p.rect(x-22,cy-10,44,19,CRT.green);p.rect(x-30,cy+step,8,16,CRT.green);p.rect(x+22,cy+5-step,8,16,CRT.green);
                p.rect(x-12,cy-5,7,6,CRT.dark);p.rect(x+5,cy-5,7,6,CRT.dark);
            }
            for(const bullet of s.bullets)p.rect(laneX(bullet.lane)-2,y(bullet.y),4,13,CRT.white);
            const x=laneX(s.lane),shipY=p.h-68;
            if(s.time-s.movedAt<.2)p.outline(laneX(s.previousLane)-24,shipY,48,14,CRT.dim,2);
            const color=s.time<s.invulnerableUntil?CRT.amber:s.time-s.movedAt<.24?CRT.white:CRT.green;
            p.rect(x-26,shipY,52,14,color);p.rect(x-7,shipY-15,14,15,color);
            if(s.shield)p.outline(x-35,shipY-22,70,48,CRT.white,2);
            p.line([[30,p.h-38],[690,p.h-38]],CRT.green,2);
            p.text(s.shield?'SHIELD +1':'AUTO FIRE',34,p.h-20,23,CRT.green);
            const chain=s.time-s.lastKill<3.5?Math.max(1,s.chain):1;
            p.text(`CHAIN x${chain}`,682,p.h-20,23,CRT.white,'right');
            bursts(s,p,b=>({...b,y:y(b.y)}),env.reducedMotion);
        }
    });
}
