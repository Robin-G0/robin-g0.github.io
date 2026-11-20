import { game, reward } from '../core/game.js?v=tutorial-3';
import { clamp, integer } from '../core/random.js';
import { C, bevel, window95, folder, fileIcon, tree, hourglass, dialog, dragOutline, zoomRects, label } from './desktop95-art.js?v=desktop95-6';
import { createFileDeck, fileSide, fileType, fileStage, knowledge } from './folder-sort-files.js?v=desktop95-6';

// A lost third heart is a game over, not a completed round.
function loseHeart(state,env,message) {
    state.lives=Math.max(0,state.lives-1);env.message(message);
    if(!state.lives)env.finish('Game over');
}

export function sort(env) {
    const draw=createFileDeck(env.random);
    const s={file:draw(0),queue:[draw(0),draw(0)],streak:0,sorted:0,level:0,deadline:5,budget:5,ready:0,receipt:null};
    s.correct=fileSide(s.file);
    function next() {
        const level=fileStage(s.sorted);
        // Refresh previews at unlocks; no advanced extension appears before its milestone.
        if(level!==s.level){s.level=level;s.queue=[draw(s.sorted),draw(s.sorted)];}
        s.file=s.queue.shift();s.queue.push(draw(s.sorted));s.correct=fileSide(s.file);
        s.budget=Math.max(1.8,5/env.pace);s.ready=s.time+.45;s.deadline=s.ready+s.budget;
    }
    return game(s,{
        feedback(){return {hideAll:true};},
        input(s,e){
            if(s.time<s.ready||!['left','right'].includes(e.action))return;
            if(e.action===s.correct){s.streak++;s.sorted++;const bonus=s.streak%5===0;
                reward(s,env,20*knowledge(s.streak).multiplier,bonus?'Knowledge up!':'');env.sound?.({kind:bonus?'powerup':'clear'});
                if(bonus)s.lives=Math.min(3,s.lives+1);
                s.receipt={side:e.action,file:s.file,at:s.time,ok:true};
            } else {s.streak=0;env.sound?.({kind:'miss'});loseHeart(s,env,'Wrong folder: check the extension.');s.receipt={side:e.action,file:s.file,at:s.time,ok:false};}
            next();
        },
        update(s){if(s.time>s.deadline){s.streak=0;env.sound?.({kind:'miss'});loseHeart(s,env,'File expired. Try the next one.');next();}},
        render(s,p){
            const compact=p.compact,reduced=env.reducedMotion;
            const rank=knowledge(s.streak),type=fileType(s.file);
            const area=window95(p,'Exploring - C:\\Inbox',`${s.sorted} object(s) copied`,`Chain ${s.streak}`,s.time,reduced);
            bevel(p,22,area.top,676,area.bottom-area.top,true,C.light);
            const top=area.top,bottom=area.bottom,scale=compact?1.35:1;
            const folderY=compact?bottom-176:246,meterY=compact?bottom-40:320,iconTop=compact?top+26:110;
            if(compact){
                p.text('MEDIA',160,top+30,32,C.blue,'center');p.text('TEXT',560,top+30,32,C.blue,'center');
                p.text('pictures,',160,top+66,27,C.dark,'center');p.text('video, sound',160,top+96,27,C.dark,'center');
                p.text('message,',560,top+66,27,C.dark,'center');p.text('code, text',560,top+96,27,C.dark,'center');
            }else{
                p.text('MEDIA',160,96,18,C.blue,'center');p.text('TEXT',560,96,18,C.blue,'center');
                p.text('(pictures, video, sound)',160,121,14,C.dark,'center');
                p.text('(message, code, text)',560,121,14,C.dark,'center');
            }
            const receipt=s.receipt&&s.time-s.receipt.at<(s.receipt.ok?.45:.9)?s.receipt:null;
            const age=receipt?s.time-receipt.at:1,landing=receipt&&receipt.ok?Math.sin(Math.min(1,age/.45)*Math.PI):0;
            folder(p,160,folderY,'L / Media',receipt?.side==='left',scale,receipt?.side==='left'&&!reduced?landing:0);
            folder(p,560,folderY,'R / Text',receipt?.side==='right',scale,receipt?.side==='right'&&!reduced?landing:0);
            const iconScale=compact?1.4:1.05;
            fileIcon(p,360,iconTop,type.icon,iconScale);
            if(s.time<s.ready)hourglass(p,360+48*iconScale,iconTop+16*iconScale,compact?3:2);
            const nameY=compact?iconTop+130:199;
            p.text(s.file,360,nameY,Math.min(compact?36:20,570/(s.file.length*.62)),C.dark,'center');
            const barY=compact?nameY+30:222,barH=compact?26:16;
            bevel(p,275,barY,170,barH,true);
            // Classic segmented progress blocks drain toward the deadline.
            const left=clamp((s.deadline-s.time)/s.budget,0,1),blocks=Math.ceil(left*14);
            for(let i=0;i<blocks;i++)p.rect(279+i*11.6,barY+4,9.6,barH-8,C.blue);
            p.text('NEXT',360,compact?barY+56:255,compact?27:12,C.shadow,'center');
            if(compact)s.queue.forEach((file,index)=>p.text(file,360,barY+90+index*32,27,'#333','center'));
            else p.text(s.queue.join('  /  '),360,275,13,C.dark,'center');
            p.text(`Knowledge: ${rank.title}  x${rank.multiplier}`,360,meterY-(compact?30:19),compact?28:15,C.blue,'center');
            bevel(p,250,meterY,220,compact?24:14,true);
            for(let i=0;i<20;i++)if(i<Math.floor(rank.progress*20))p.rect(254+i*10.6,meterY+4,8,compact?16:6,C.blue);
            if(receipt){
                const x=receipt.side==='left'?160:560;
                if(receipt.ok){
                    // The shell's dotted drag outline travels from the file to the folder.
                    if(!reduced&&age<.36){
                        const t=1-Math.pow(1-age/.36,3),w=54*iconScale,h=64*iconScale;
                        dragOutline(p,360-w/2+(x-360)*t,iconTop+(folderY-iconTop-h/2)*t,w,h);
                    }
                    p.text('\u2713 Copied',x,folderY-(compact?70:53),compact?30:19,'#176a49','center');
                }else dialog(p,x,folderY-(compact?80:60),compact?290:190,compact?96:62,'Error','Wrong folder',{age,reduced});
            }
        }
    });
}

export function stack(env) {
    const s={x:28,velocity:100,width:270,layers:[{x:225,width:270}],placements:0,perfect:0,flash:null,reversedAt:-10,missAt:-10};
    return game(s,{
        feedback(){return {hideAll:true};},
        input(s,e){
            if(e.action==='right'){s.velocity*=-1;s.reversedAt=s.time;env.sound?.({kind:'input',action:'right'});return;}
            if(e.action!=='left')return;
            const last=s.layers.at(-1),error=Math.abs(last.x-s.x),snap=error<=24;
            const overlap=Math.min(last.x+last.width,s.x+s.width)-Math.max(last.x,s.x);
            if(overlap<45&&!snap){s.missAt=s.time;env.sound?.({kind:'miss'});loseHeart(s,env,'Missed the stack. Your last window is safe.');s.perfect=0;s.x=28;return;}
            const width=snap?Math.min(290,last.width+12):overlap;
            const x=snap?clamp(last.x+(last.width-width)/2,26,694-width):Math.max(last.x,s.x);
            s.width=width;s.layers.push({x,width});s.layers=s.layers.slice(-8);s.placements++;
            s.perfect=snap?s.perfect+1:0;s.flash={at:s.time,snap};
            reward(s,env,snap?40:20,snap?'Snap! +40':'');env.sound?.({kind:'clear',count:snap?3:1});
            if(s.perfect&&s.perfect%4===0)s.lives=Math.min(3,s.lives+1);
            s.x=28;s.velocity=Math.min(160,100+s.placements*3);
        },
        update(s,dt){s.x+=Math.sign(s.velocity)*Math.min(210,Math.abs(s.velocity)*env.pace)*dt;
            if(s.x<26||s.x+s.width>694){s.x=clamp(s.x,26,694-s.width);s.velocity*=-1;}},
        render(s,p){
            const compact=p.compact,reduced=env.reducedMotion,layerHeight=compact?44:27;
            const area=window95(p,'C:\\WINDOWS\\Desktop',`${s.placements} window(s) placed`,`Snaps ${s.perfect % 4}/4`,s.time,reduced);
            // The client area is a little desktop: teal wallpaper, inactive windows below, the active one moving.
            bevel(p,22,area.top,676,area.bottom-area.top,true,C.teal);
            const bottom=area.bottom-layerHeight-8;
            const mini=(x,y,w,active,caption,flash=false)=>{
                bevel(p,x,y,w,layerHeight-2);
                const bar=active?(flash?C.shadow:C.blue):(flash?C.blue:C.shadow);
                p.rect(x+3,y+3,w-6,layerHeight-8,bar);
                const box=layerHeight-12;
                if(w>box+30){bevel(p,x+w-box-6,y+5,box,box-2);p.text('\u00d7',x+w-box/2-6,y+3+box/2,compact?22:11,C.dark,'center');}
                if(caption)p.text(caption,x+10,y+layerHeight/2-1,compact?27:12,C.light);
            };
            const flash=s.flash&&s.time-s.flash.at<.7?s.flash:null;
            s.layers.forEach((layer,index)=>{
                const top=index===s.layers.length-1;
                let y=bottom-index*layerHeight;
                // The newest window settles with a short exponential drop; snaps blink the caption twice, like FlashWindow.
                const age=flash&&top?s.time-flash.at:1;
                if(!reduced&&age<.16)y-=layerHeight*Math.exp(-age*28);
                const blink=!reduced&&flash?.snap&&top&&age<.5&&Math.floor(age/.125)%2===0;
                mini(layer.x,y,layer.width,false,layer.width>(compact?190:125)?`Window ${Math.max(1,s.placements-s.layers.length+index+2)}`:'',blink);
            });
            const target=s.layers.at(-1),y=bottom-layerHeight*s.layers.length;
            const center=target.x+s.width/2;
            // The accepted snap window is a 48-unit band for the moving window's center.
            p.outline(target.x,y-4,target.width,layerHeight+8,'#9fd8c6',1);
            p.rect(center-24,y-4,48,layerHeight+8,'#bbe8d9');
            p.line([[center-24,y-4],[center-24,y+layerHeight+4]],'#176a49',2,[3,4]);
            p.line([[center+24,y-4],[center+24,y+layerHeight+4]],'#176a49',2,[3,4]);
            const reversing=s.time-s.reversedAt<.3;
            mini(s.x,y,s.width,true,'');
            p.text(reversing?(s.velocity>0?'->':'<-'):s.width>(compact?190:125)?'Untitled':'...',s.x+(s.width-layerHeight)/2,y+layerHeight/2-1,compact?28:14,C.light,'center');
            const pointer=s.x+s.width/2;
            p.line([[pointer,y-7],[pointer-8,y-21],[pointer+8,y-21],[pointer,y-7]],C.light,compact?4:3);
            p.line([[pointer,y-7],[pointer-8,y-21],[pointer+8,y-21],[pointer,y-7]],'#176a49',2);
            if(flash){
                const age=s.time-flash.at,lift=reduced?0:Math.min(1,age/.7)*12;
                p.text(flash.snap?'SNAP! +40':'PLACED +20',360,area.top+(compact?40:26)-lift,compact?36:20,C.light,'center');
            }
            const missAge=s.time-(s.missAt??-10);
            if(missAge>=0&&missAge<.9)dialog(p,360,area.top+(compact?110:80),compact?330:220,compact?96:62,'Error','Missed the stack',{age:missAge,reduced});
        }
    });
}

export function ski(env) {
    const s={lane:1,gates:[{gap:1,y:95}],nextGate:3,route:1,cleared:0,combo:0,recoveryUntil:0,movedAt:-10};
    const look={lane:1,dir:0,at:-10,cleared:0,passAt:-10,bonus:false}; // Display-only; never part of the game state.
    return game(s,{
        feedback(){return {hideAll:true};},
        input(s,e){const old=s.lane;if(e.action==='left')s.lane=Math.max(0,s.lane-1);if(e.action==='right')s.lane=Math.min(2,s.lane+1);s.movedAt=s.time;if(old!==s.lane)env.sound?.({kind:'input',action:e.action});},
        update(s,dt){
            const speed=Math.min(155,72*env.pace);
            if(s.time>=s.nextGate){const options=[s.route-1,s.route,s.route+1].filter(x=>x>=0&&x<=2);s.route=options[integer(env.random,0,options.length-1)];s.gates.push({gap:s.route,y:-30});s.nextGate=s.time+Math.max(2.3,3.7/env.pace);}
            for(const gate of s.gates){gate.y+=speed*dt;if(!gate.passed&&gate.y>=285){gate.passed=true;
                if(s.lane===gate.gap){s.combo++;s.cleared++;env.sound?.({kind:s.combo%5===0?'powerup':'clear'});reward(s,env,20+(s.combo%5===0?50:0),s.combo%5===0?'Clean slalom +50':'');}
                else {s.combo=0;s.recoveryUntil=s.time+.65;env.sound?.({kind:'miss'});loseHeart(s,env,'Tree hit. Aim for the striped gate.');}
            }}
            s.gates=s.gates.filter(gate=>gate.y<360);
        },
        render(s,p){
            const compact=p.compact,reduced=env.reducedMotion,k=compact?1.45:1;
            const area=window95(p,'Slope - Mountain Resort',`${s.cleared} gate(s) passed`,`Chain ${s.combo}`,s.time,reduced);
            bevel(p,22,area.top,676,area.bottom-area.top,true,'#f8fcff');
            const top=area.top+10,bottom=area.bottom-6,y=value=>top+(value-82)*(area.bottom-area.top-20)/262;
            // Display-only memory of the last lane change and gate result, for the lean, spray and pop-up score.
            if(s.lane!==look.lane){look.dir=Math.sign(s.lane-look.lane);look.lane=s.lane;look.at=s.time;}
            if(s.cleared!==look.cleared){look.cleared=s.cleared;look.passAt=s.time;look.bonus=s.combo%5===0;}
            if(s.time<look.at||s.time<look.passAt){look.at=-10;look.passAt=-10;}
            for(let i=0;i<26;i++){const x=45+(i*103)%635,cy=top+(i*43+(reduced?0:s.time*35))%Math.max(1,bottom-top-6);p.rect(x,cy,compact?3:2,compact?4:3,'#bcd4e1');}
            for(const x of [255,465])p.line([[x,top],[x,bottom]],'#d0e1e9',1,[4,9]);
            const skierY=y(285),x=150+s.lane*210,moved=s.time-look.at;
            // Ski tracks trail behind the skier; a fresh lane change bends them.
            const bend=!reduced&&moved<.5?-look.dir*Math.max(0,1-moved/.5)*60:0;
            for(const side of [-7,7])p.line([[x+side,skierY+40*k],[x+side+bend*.5,skierY+90*k],[x+side+bend,bottom]],'#d6e4ec',2);
            const hit=s.time<s.recoveryUntil;
            for(const gate of s.gates){if(gate.y<90||gate.y>325)continue;
                const gy=y(gate.y);
                for(let lane=0;lane<3;lane++){const gx=150+lane*210;if(lane!==gate.gap){
                    // The tree that was hit shakes during recovery.
                    const shaking=hit&&gate.passed&&lane===s.lane&&!reduced;
                    tree(p,gx,gy,k,shaking?Math.sin(s.time*40)*4*(s.recoveryUntil-s.time):0);
                }else {
                    p.line([[gx-45,gy-20*k],[gx-45,gy+25*k]],'#d84242',4);p.line([[gx+45,gy-20*k],[gx+45,gy+25*k]],'#d84242',4);
                    // Pennants flutter on simulation time.
                    const flap=reduced?0:Math.sin(s.time*7+gate.y*.05)*4;
                    for(const side of [-1,1])p.line([[gx+side*45,gy-20*k],[gx+side*45+side*16,gy-14*k+flap],[gx+side*45,gy-8*k],[gx+side*45,gy-20*k]],'#d84242',3);
                    p.line([[gx-40,gy],[gx+40,gy]],'#399277',2,[6,6]);p.text('↓',gx,gy-12*k,compact?40:24,'#176a49','center');
                }}
            }
            p.line([[40,skierY],[680,skierY]],'#b0c6d2',1,[3,7]);
            const color=hit?'#bf3535':moved<.25?'#176a49':C.blue;
            const lean=!reduced&&moved<.3?look.dir*(1-moved/.3)*8:0;
            if(!reduced&&moved<.4&&look.dir){
                // A small snow spray kicks out on the outside of the turn (deterministic, no RNG).
                for(let i=0;i<7;i++){const t=moved/.4,a=i*.45;p.rect(x-look.dir*(14+t*(26+i*5))*k,skierY+(30-Math.sin(a)*t*22)*k,4,4,i%2?'#bcd4e1':'#ffffff');}
            }
            p.line([[x-13*k+lean,skierY+21*k],[x-17*k,skierY+40*k]],'#444',3*k);p.line([[x+8*k+lean,skierY+20*k],[x+14*k,skierY+40*k]],'#444',3*k);
            p.line([[x-24*k,skierY+40*k],[x+6*k,skierY+44*k]],'#202020',3);p.line([[x-2*k,skierY+44*k],[x+26*k,skierY+40*k]],'#202020',3);
            p.circle(x+lean*1.3,skierY-5*k,7*k,'#e9ae76');p.rect(x+lean*1.3-7*k,skierY-14*k,14*k,5*k,'#d84242');
            p.line([[x+lean,skierY+2*k],[x,skierY+20*k]],color,7*k);p.line([[x-16*k,skierY+15*k],[x+lean,skierY+6*k],[x+17*k,skierY+15*k]],color,4*k);
            const passAge=s.time-look.passAt;
            if(passAge>=0&&passAge<.8)p.text(look.bonus?'+70':'+20',x,skierY-(30+(reduced?0:passAge*30))*k,compact?34:20,'#176a49','center');
            if(hit)dialog(p,360,area.top+(compact?80:60),compact?300:200,compact?96:62,'Error','Tree hit',{age:.65-(s.recoveryUntil-s.time),reduced});
        }
    });
}
