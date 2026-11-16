import {game} from '../../core/game.js';
import {clamp} from '../../core/random.js';
import {CRT,terminal,stars,meter,addBurst,bursts,pruneBursts,loseLife} from './display.js';

export const LANDER={pad:320,safeSpeed:32,perfectSpeed:8,thrust:24,thrustFuel:6,brakeFuel:12,brakeSeconds:2.4};
export function landingPoints(speed,fuel) {
    return speed>LANDER.safeSpeed?0:(100+Math.max(0,Math.floor(fuel))*2)*(speed<=LANDER.perfectSpeed?2:1);
}

/** Two fuel decisions, with physics independent of display dimensions. */
export function lander(env) {
    const s={y:64,velocity:8,fuel:100,landings:0,flameUntil:0,brakeAt:-10,
        pulseAt:-10,pulse:'',recoveryUntil:0,bursts:[],ended:false};
    function launch() {s.y=64;s.velocity=8;s.fuel=100;s.brakeAt=-10;s.pulse='';}
    return game(s,{
        feedback:()=>({hideAll:true}),
        input(s,event) {
            if(s.ended||s.time<s.recoveryUntil)return;
            s.pulse=event.action;s.pulseAt=s.time;
            if(event.action==='left' && s.fuel>=LANDER.thrustFuel){
                s.fuel-=LANDER.thrustFuel;s.velocity=Math.max(-38,s.velocity-LANDER.thrust);
                s.flameUntil=s.time+.3;env.sound?.({kind:'thrust'});
            }
            if(event.action==='right' && s.fuel>=LANDER.brakeFuel && s.time-s.brakeAt>=LANDER.brakeSeconds && s.velocity>15){
                s.fuel-=LANDER.brakeFuel;s.velocity=15;s.brakeAt=s.time;
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
            const points=landingPoints(s.velocity,s.fuel);
            if(points){
                s.score+=points;s.landings++;
                const perfect=s.velocity<=LANDER.perfectSpeed;
                addBurst(s,perfect?`PERFECT x2 +${points}`:`LANDED +${points}`,360,250);
                env.sound?.({kind:perfect?'powerup':'clear',count:2});
            }else{
                loseLife(s,env);addBurst(s,'TOO FAST',360,250,false);
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
            p.line([[36,ground+20],[90,ground-8],[135,ground+10],[200,ground-23],[270,ground+8],
                [295,ground],[425,ground],[490,ground-12],[540,ground+22],[610,ground-4],[684,ground+15]],CRT.dim,2);
            p.line([[290,ground],[430,ground]],CRT.green,5);
            for(const x of [290,430])p.line([[x,ground],[x,ground-20]],CRT.white,3);
            // Separate thruster and brake responses on the craft itself.
            const pulse=s.time-s.pulseAt<.25;
            const color=s.recoveryUntil?(s.velocity<=LANDER.safeSpeed?CRT.white:CRT.amber):pulse?CRT.white:CRT.green;
            p.line([[340,y-14],[380,y-14],[388,y+9],[332,y+9],[340,y-14]],color,3);
            p.outline(349,y-7,22,13,CRT.white,2);
            p.line([[335,y+8],[321,y+24],[310,y+24]],color,3);
            p.line([[385,y+8],[399,y+24],[410,y+24]],color,3);
            if(s.time<s.flameUntil){
                const length=env.reducedMotion?26:24+Math.sin(s.time*22)*6;
                p.line([[350,y+11],[360,y+length+14],[370,y+11]],CRT.amber,3);
                if(s.pulse==='right')p.line([[332,y+5],[310,y-7]],CRT.amber,3);
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
            p.text('L THRUST',40,p.h-35,26,s.pulse==='left'&&pulse?CRT.white:CRT.green);
            p.text('R BRAKE',680,p.h-35,26,s.pulse==='right'&&pulse?CRT.white:CRT.green,'right');
            bursts(s,p,b=>({...b,y:ground-65}),env.reducedMotion);
        }
    });
}
