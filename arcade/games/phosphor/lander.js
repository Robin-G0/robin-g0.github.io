import {game} from '../../core/game.js';
import {clamp} from '../../core/random.js';
import {CRT,terminal,stars,meter,addBurst,bursts,pruneBursts,loseLife} from './display.js';

export const LANDER={pad:320,safeSpeed:32,perfectSpeed:8,thrust:18,thrusterFuel:4,
    chordSeconds:.12,step:48,minX:216,maxX:504,padHalfWidth:96,footHalfWidth:42};
export const padForLanding=index=>[264,456,312,408,360][index%5];
export function landingPoints(speed,fuel,centered=true) {
    return speed>LANDER.safeSpeed?0:(100+Math.max(0,Math.floor(fuel))*2)*(speed<=LANDER.perfectSpeed&&centered?2:1);
}

/** Two fixed impulses: left engine pushes right, right pushes left; together they cancel sideways. */
export function lander(env) {
    const s={x:360,padX:padForLanding(0),y:64,velocity:8,fuel:100,landings:0,flameUntil:0,
        pulseAt:-10,pulse:'',pending:null,recoveryUntil:0,bursts:[],ended:false};
    function launch() {s.x=360;s.padX=padForLanding(s.landings);s.y=64;s.velocity=8;s.fuel=100;s.pulse='';s.pending=null;}
    function burn() {
        const mask=s.pending.mask;s.pending=null;
        const engines=mask===3?2:1,cost=Math.min(s.fuel,engines*LANDER.thrusterFuel);
        if(!cost)return;
        s.fuel-=cost;
        // Every valid burn brakes descent; never turn a steering correction into a faster fall.
        s.velocity=Math.max(0,s.velocity-LANDER.thrust*cost/LANDER.thrusterFuel);
        if(mask!==3)s.x=clamp(s.x+(mask===1?LANDER.step:-LANDER.step),LANDER.minX,LANDER.maxX);
        s.pulse=mask===3?'center':mask===1?'left':'right';s.pulseAt=s.time;s.flameUntil=s.time+.35;
        env.sound?.({kind:'thrust'});
    }
    return game(s,{
        feedback:()=>({hideAll:true}),
        input(s,event) {
            if(s.ended||s.time<s.recoveryUntil)return;
            const mask=event.action==='left'?1:event.action==='right'?2:0;if(!mask)return;
            if(s.pending&&s.time>=s.pending.until)burn();
            if(!s.pending)s.pending={mask:0,until:s.time+LANDER.chordSeconds};
            s.pending.mask|=mask;
            // Give immediate engine feedback while allowing a second wrist's slightly later native pulse.
            s.pulse=s.pending.mask===3?'center':event.action;s.pulseAt=s.time;
            if(s.pending.mask===3)burn();
        },
        pause(s){s.pending=null;},
        update(s,dt) {
            pruneBursts(s);if(s.ended)return;
            if(s.recoveryUntil){
                if(s.time>=s.recoveryUntil){s.recoveryUntil=0;launch();}
                return;
            }
            // A recognized last-moment raise must not wait beyond touchdown for a possible partner.
            if(s.pending&&(s.time>=s.pending.until||s.y+Math.max(0,s.velocity)*dt>=LANDER.pad))burn();
            s.velocity+=(14+Math.min(12,s.landings)*1.3)*env.pace*dt;
            s.y+=s.velocity*dt;
            if(s.y<55){s.y=55;s.velocity=Math.max(0,s.velocity);}
            if(s.y<LANDER.pad)return;
            s.y=LANDER.pad;
            const offset=Math.abs(s.x-s.padX),onPad=offset+LANDER.footHalfWidth<=LANDER.padHalfWidth;
            const points=onPad?landingPoints(s.velocity,s.fuel,offset<=18):0;
            s.touchdownGood=points>0;
            if(points){
                s.score+=points;s.landings++;
                const perfect=s.velocity<=LANDER.perfectSpeed&&offset<=18;
                addBurst(s,perfect?`PERFECT x2 +${points}`:`LANDED +${points}`,s.padX,250);
                env.sound?.({kind:perfect?'powerup':'clear',count:2});
            }else{
                loseLife(s,env);addBurst(s,onPad?'TOO FAST':'OFF PAD',s.x,250,false);
            }
            s.recoveryUntil=s.time+1.15;s.flameUntil=0;s.pending=null;
        },
        render(s,p) {
            terminal(p,'LUNAR LANDER',`PAD ${s.landings+1}`);stars(p,p.h-95);
            const ground=p.h-86,y=145+(s.y-64)*(ground-169)/256;
            p.text('FUEL',40,84,25,CRT.green);meter(p,125,77,205,s.fuel/100,s.fuel<24?CRT.amber:CRT.green);
            p.text(String(s.fuel),344,84,26,CRT.white);
            p.text('ENGINES',430,84,25,CRT.green);
            const lit=s.time-s.pulseAt<.35;
            for(const [engine,x]of [['left',565],['right',640]]){
                p.outline(x-21,68,42,29,lit&&(s.pulse===engine||s.pulse==='center')?CRT.white:CRT.dim,2);
                p.text(engine==='left'?'L':'R',x,83,25,lit&&(s.pulse===engine||s.pulse==='center')?CRT.white:CRT.green,'center');
            }
            const padLeft=s.padX-LANDER.padHalfWidth,padRight=s.padX+LANDER.padHalfWidth;
            p.line([[36,ground+20],[90,ground-8],[135,ground+10],[padLeft,ground],[padRight,ground],
                [570,ground+22],[610,ground-4],[684,ground+15]],CRT.dim,2);
            const aligned=Math.abs(s.x-s.padX)+LANDER.footHalfWidth<=LANDER.padHalfWidth;
            p.line([[padLeft,ground],[padRight,ground]],aligned?CRT.white:CRT.green,5);
            for(const x of [padLeft,padRight])p.line([[x,ground],[x,ground-20]],CRT.white,3);
            p.line([[s.padX,ground-8],[s.padX,ground+8]],CRT.white,2);
            // A quiet landing guide shows the current fixed X; it never steers for you.
            p.line([[s.x,y+30],[s.x,ground-12]],aligned?CRT.dim:CRT.amber,1,[3,10]);
            p.text(aligned?'ON PAD':s.x>s.padX?'< PAD':'PAD >',s.padX,ground+28,25,aligned?CRT.white:CRT.amber,'center');
            // Opposite canted engines steer; their combined burn is visibly central.
            const pulse=s.time-s.pulseAt<.25;
            const color=s.recoveryUntil?(s.touchdownGood?CRT.white:CRT.amber):pulse?CRT.white:CRT.green,x=s.x;
            p.line([[x-20,y-14],[x+20,y-14],[x+28,y+9],[x-28,y+9],[x-20,y-14]],color,3);
            p.outline(x-11,y-7,22,13,CRT.white,2);
            p.line([[x-25,y+8],[x-39,y+24],[x-50,y+24]],color,3);
            p.line([[x+25,y+8],[x+39,y+24],[x+50,y+24]],color,3);
            if(s.time<s.flameUntil){
                const length=env.reducedMotion?26:24+Math.sin(s.time*22)*6;
                if(s.pulse==='center')p.line([[x-13,y+11],[x,y+length+17],[x+13,y+11]],CRT.amber,4);
                else{
                    const side=s.pulse==='left'?-1:1;
                    p.line([[x+side*20,y+9],[x+side*44,y+length],[x+side*30,y+7]],CRT.amber,3);
                }
            }
            const speed=Math.max(0,Math.round(s.velocity)),safe=speed<=LANDER.safeSpeed;
            p.text('DESCENT',40,145,25,CRT.green);
            p.text(s.velocity<0?'UP':speed,40,184,43,safe?CRT.white:CRT.amber);
            p.text('SAFE <=32',40,222,24,CRT.green);
            p.text('x2 <=8',40,256,24,CRT.white);
            const gaugeX=651,top=140,height=Math.max(100,ground-top-20);
            p.line([[gaugeX,top],[gaugeX,top+height]],CRT.dim,3);
            for(let i=0;i<=8;i++)p.line([[gaugeX-8,top+i*height/8],[gaugeX+8,top+i*height/8]],CRT.dim,2);
            const altitude=clamp((s.y-64)/256,0,1);
            p.line([[gaugeX-20,top+altitude*height],[gaugeX+20,top+altitude*height]],CRT.white,4);
            p.text('L ENGINE',40,p.h-35,26,s.pulse==='left'&&pulse?CRT.white:CRT.green);
            p.text(s.pulse==='center'&&pulse?'CENTER':'R ENGINE',680,p.h-35,26,lit?CRT.white:CRT.green,'right');
            bursts(s,p,b=>({...b,y:ground-65}),env.reducedMotion);
        }
    });
}
