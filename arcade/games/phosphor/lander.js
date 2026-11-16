import {game} from '../../core/game.js';
import {clamp} from '../../core/random.js';
import {CRT,terminal,stars,meter,addBurst,bursts,pruneBursts,loseLife} from './display.js';

export const LANDER={pad:320,safeSpeed:32,perfectSpeed:8,thrust:24,thrustFuel:6,
    brake:18,brakeFuel:4,brakeSeconds:.65,step:48,minX:216,maxX:504,padHalfWidth:96,footHalfWidth:42};
const flightCommands={left_up:'brake',right_up:'thrust',left_left:'steer_left',right_left:'steer_left',
    left_right:'steer_right',right_right:'steer_right'};
export const padForLanding=index=>[264,456,312,408,360][index%5];
export function landingPoints(speed,fuel,centered=true) {
    return speed>LANDER.safeSpeed?0:(100+Math.max(0,Math.floor(fuel))*2)*(speed<=LANDER.perfectSpeed&&centered?2:1);
}

/** Fixed lateral steps have no drift; raises brake (L) and thrust (R). */
export function lander(env) {
    const s={x:360,padX:padForLanding(0),y:64,velocity:8,fuel:100,landings:0,flameUntil:0,brakeAt:-10,
        pulseAt:-10,pulse:'',recoveryUntil:0,bursts:[],ended:false};
    function launch() {s.x=360;s.padX=padForLanding(s.landings);s.y=64;s.velocity=8;s.fuel=100;s.brakeAt=-10;s.pulse='';}
    return game(s,{
        feedback:()=>({hideAll:true}),
        input(s,event) {
            if(s.ended||s.time<s.recoveryUntil)return;
            const action=flightCommands[event.action];
            if(!action)return;
            s.pulse=action;s.pulseAt=s.time;
            if(action.startsWith('steer_')){
                s.x=clamp(s.x+(action==='steer_left'?-LANDER.step:LANDER.step),LANDER.minX,LANDER.maxX);
                env.sound?.({kind:'turn',action:action==='steer_left'?'left':'right'});return;
            }
            if(action==='thrust' && s.fuel>=LANDER.thrustFuel){
                s.fuel-=LANDER.thrustFuel;s.velocity=Math.max(-38,s.velocity-LANDER.thrust);
                s.flameUntil=s.time+.3;env.sound?.({kind:'thrust'});
            }
            if(action==='brake' && s.fuel>=LANDER.brakeFuel && s.time-s.brakeAt>=LANDER.brakeSeconds && s.velocity>0){
                s.fuel-=LANDER.brakeFuel;s.velocity=Math.max(0,s.velocity-LANDER.brake);s.brakeAt=s.time;
                s.flameUntil=s.time+.5;env.sound?.({kind:'brake'});
            }
        },
        update(s,dt) {
            pruneBursts(s);if(s.ended)return;
            if(s.recoveryUntil){
                if(s.time>=s.recoveryUntil){s.recoveryUntil=0;launch();}
                return;
            }
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
            s.recoveryUntil=s.time+1.15;s.flameUntil=0;
        },
        render(s,p) {
            terminal(p,'LUNAR LANDER',`PAD ${s.landings+1}`);stars(p,p.h-95);
            const ground=p.h-86,y=145+(s.y-64)*(ground-169)/256;
            p.text('FUEL',40,84,25,CRT.green);meter(p,125,77,205,s.fuel/100,s.fuel<24?CRT.amber:CRT.green);
            p.text(String(s.fuel),344,84,26,CRT.white);
            p.text('BRAKE',430,84,25,CRT.green);
            const ready=clamp((s.time-s.brakeAt)/LANDER.brakeSeconds,0,1);
            meter(p,520,77,150,ready,ready===1?CRT.white:CRT.dim);
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
            // Separate thruster and brake responses on the craft itself.
            const pulse=s.time-s.pulseAt<.25;
            const color=s.recoveryUntil?(s.touchdownGood?CRT.white:CRT.amber):pulse?CRT.white:CRT.green,x=s.x;
            p.line([[x-20,y-14],[x+20,y-14],[x+28,y+9],[x-28,y+9],[x-20,y-14]],color,3);
            p.outline(x-11,y-7,22,13,CRT.white,2);
            p.line([[x-25,y+8],[x-39,y+24],[x-50,y+24]],color,3);
            p.line([[x+25,y+8],[x+39,y+24],[x+50,y+24]],color,3);
            if(pulse&&s.pulse.startsWith('steer_')){
                const direction=s.pulse==='steer_left'?-1:1;
                p.line([[x-direction*35,y],[x-direction*60,y+5]],CRT.amber,4);
            }
            if(s.time<s.flameUntil){
                const length=env.reducedMotion?26:24+Math.sin(s.time*22)*6;
                p.line([[x-10,y+11],[x,y+length+14],[x+10,y+11]],CRT.amber,3);
                if(s.pulse==='brake')p.line([[x-28,y+5],[x-50,y-7]],CRT.amber,3);
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
            p.text('L BRAKE',40,p.h-35,26,s.pulse==='brake'&&pulse?CRT.white:CRT.green);
            p.text('R THRUST',680,p.h-35,26,s.pulse==='thrust'&&pulse?CRT.white:CRT.green,'right');
            bursts(s,p,b=>({...b,y:ground-65}),env.reducedMotion);
        }
    });
}
