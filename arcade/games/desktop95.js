import { game, reward } from '../core/game.js?v=tutorial-3';
import { clamp, integer } from '../core/random.js';
import { C, bevel, window95, folder, fileIcon, tree } from './desktop95-art.js?v=desktop95-3';

// A lost third heart is a game over, not a completed round.
function loseHeart(state,env,message) {
    state.lives=Math.max(0,state.lives-1);env.message(message);
    if(!state.lives)env.finish('Game over');
}

export function sort(env) {
    const files=['photo.png','notes.txt','holiday.jpg','readme.md','icon.bmp','letter.rtf','party.gif','todo.txt'];
    let bag=[];
    function draw() {
        if(!bag.length) {bag=[...files];for(let i=bag.length-1;i>0;i--){const j=integer(env.random,0,i);[bag[i],bag[j]]=[bag[j],bag[i]];}}
        return bag.pop();
    }
    const s={file:draw(),queue:[draw(),draw()],streak:0,sorted:0,deadline:5,budget:5,ready:0,receipt:null};
    const side=file=>/\.(png|jpg|bmp|gif)$/.test(file)?'left':'right';
    s.correct=side(s.file);
    function next() {
        s.file=s.queue.shift();s.queue.push(draw());s.correct=side(s.file);
        s.budget=Math.max(1.8,5/env.pace);s.ready=s.time+.45;s.deadline=s.ready+s.budget;
    }
    return game(s,{
        feedback(){return {hideAll:true};},
        input(s,e){
            if(s.time<s.ready||!['left','right'].includes(e.action))return;
            if(e.action===s.correct){s.streak++;s.sorted++;const bonus=s.streak%5===0;
                reward(s,env,20+Math.min(5,Math.floor(s.streak/5))*10,bonus?'Five-file bonus!':'');env.sound?.({kind:bonus?'powerup':'clear'});
                if(bonus)s.lives=Math.min(3,s.lives+1);
                s.receipt={side:e.action,file:s.file,at:s.time,ok:true};
            } else {s.streak=0;env.sound?.({kind:'miss'});loseHeart(s,env,'Wrong folder: check the extension.');s.receipt={side:e.action,file:s.file,at:s.time,ok:false};}
            next();
        },
        update(s){if(s.time>s.deadline){s.streak=0;env.sound?.({kind:'miss'});loseHeart(s,env,'File expired. Try the next one.');next();}},
        render(s,p){
            const compact=p.compact,folderY=compact?p.h-215:246;
            const receipt=s.receipt&&s.time-s.receipt.at<.45?s.receipt:null;
            window95(p,'Folder Sort \u2014 C:\\Inbox',`${s.sorted} copied / chain ${s.streak}`,s.score,s.lives);
            p.rect(24,compact?81:72,672,p.h-(compact?162:153),'#f4f4f4');
            p.text('IMAGES',160,compact?108:96,compact?30:18,C.blue,'center');p.text('DOCUMENTS',560,compact?108:96,compact?30:18,C.blue,'center');
            if(compact){
                p.text('PNG JPG',160,144,27,'#555','center');p.text('BMP GIF',160,175,27,'#555','center');
                p.text('TXT MD',560,144,27,'#555','center');p.text('RTF',560,175,27,'#555','center');
            }else{
                p.text('PNG \u00b7 JPG \u00b7 BMP \u00b7 GIF',160,119,13,'#555','center');p.text('TXT \u00b7 MD \u00b7 RTF',560,119,13,'#555','center');
            }
            folder(p,160,folderY,'L / Images',receipt?.side==='left',compact?1.35:1);
            folder(p,560,folderY,'R / Text',receipt?.side==='right',compact?1.35:1);
            fileIcon(p,360,compact?160:135,side(s.file)==='left',compact?1.5:1.15);
            p.text(s.file,360,compact?290:230,compact?40:20,'#111','center');
            const barY=compact?325:253;
            bevel(p,275,barY,170,compact?24:16,true);p.rect(279,barY+4,162*clamp((s.deadline-s.time)/s.budget,0,1),compact?16:8,C.blue);
            p.text('NEXT',360,compact?385:290,compact?24:11,'#555','center');
            if(compact)s.queue.forEach((file,index)=>p.text(file,360,420+index*34,27,'#333','center'));
            else p.text(s.queue.join('  \u2192  '),360,312,12,'#333','center');
            if(receipt){const x=receipt.side==='left'?160:560;p.text(receipt.ok?'\u2713 Copied':'\u00d7 Type',x,folderY-(compact?65:53),compact?30:19,receipt.ok?'#176a49':'#a32626','center');}

        }
    });
}

export function stack(env) {
    const s={x:28,velocity:100,width:270,layers:[{x:225,width:270}],placements:0,perfect:0,flash:null,reversedAt:-10};
    return game(s,{
        feedback(){return {hideAll:true};},
        input(s,e){
            if(e.action==='right'){s.velocity*=-1;s.reversedAt=s.time;env.sound?.({kind:'input',action:'right'});return;}
            if(e.action!=='left')return;
            const last=s.layers.at(-1),error=Math.abs(last.x-s.x),snap=error<=24;
            const overlap=Math.min(last.x+last.width,s.x+s.width)-Math.max(last.x,s.x);
            if(overlap<45&&!snap){env.sound?.({kind:'miss'});loseHeart(s,env,'Missed the stack. Your last window is safe.');s.perfect=0;s.x=28;return;}
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
            const layerHeight=p.compact?42:27,bottom=p.h-103;
            window95(p,'Window Stack',`${s.placements} placed / snaps ${s.perfect}`,s.score,s.lives);
            p.rect(24,p.compact?81:72,672,p.h-(p.compact?162:153),'#edf1f5');
            s.layers.forEach((layer,index)=>{
                const y=bottom-index*layerHeight;
                bevel(p,layer.x,y,layer.width,layerHeight-2);p.rect(layer.x+3,y+3,layer.width-6,layerHeight-9,C.blue);
                if(layer.width>125)p.text(`Window ${Math.max(1,s.placements-s.layers.length+index+2)}`,layer.x+10,y+layerHeight/2,p.compact?24:11,'#fff');
            });
            const target=s.layers.at(-1),y=bottom-layerHeight*s.layers.length;
            const center=target.x+s.width/2;
            // The accepted snap window is a 48-unit band for the moving window's center.
            p.outline(target.x,y-4,target.width,layerHeight+8,'#4c7769',1);
            p.rect(center-24,y-4,48,layerHeight+8,'#bbe8d9');
            p.line([[center-24,y-4],[center-24,y+layerHeight+4]],'#176a49',2,[3,4]);
            p.line([[center+24,y-4],[center+24,y+layerHeight+4]],'#176a49',2,[3,4]);
            bevel(p,s.x,y,s.width,layerHeight);p.rect(s.x+3,y+3,s.width-6,layerHeight-9,C.blue);
            p.text(s.time-s.reversedAt<.3?(s.velocity>0?'->':'<-'):s.width>125?'Untitled':'...',s.x+s.width/2,y+layerHeight/2,p.compact?28:14,'#fff','center');
            p.line([[s.x+s.width/2,y-7],[s.x+s.width/2-7,y-19],[s.x+s.width/2+7,y-19],[s.x+s.width/2,y-7]],'#176a49',2);
            if(s.flash&&s.time-s.flash.at<.7)p.text(s.flash.snap?'SNAP! +40':'PLACED +20',360,p.compact?112:91,p.compact?34:20,C.blue,'center');

        }
    });
}

export function ski(env) {
    const s={lane:1,gates:[{gap:1,y:95}],nextGate:3,route:1,cleared:0,combo:0,recoveryUntil:0,movedAt:-10};
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
            const bottom=p.h-83,y=value=>82+(value-82)*(p.h-158)/262;
            window95(p,'Ski Run \u2014 Mountain Resort',`${s.cleared} gates / chain ${s.combo}`,s.score,s.lives);
            p.rect(24,p.compact?81:72,672,p.h-(p.compact?162:153),'#f8fcff');
            for(let i=0;i<24;i++){const x=45+(i*103)%635,cy=85+(i*43+(env.reducedMotion?0:s.time*35))%Math.max(1,bottom-90);p.rect(x,cy,2,3,'#bcd4e1');}
            for(const x of [255,465])p.line([[x,84],[x,bottom]],'#d0e1e9',1,[4,9]);
            for(const gate of s.gates){if(gate.y<90||gate.y>325)continue;
                const gy=y(gate.y);
                for(let lane=0;lane<3;lane++){const x=150+lane*210;if(lane!==gate.gap)tree(p,x,gy);else {
                    p.line([[x-45,gy-20],[x-45,gy+25]],'#d84242',4);p.line([[x+45,gy-20],[x+45,gy+25]],'#d84242',4);
                    p.line([[x-40,gy],[x+40,gy]],'#399277',2,[6,6]);p.text('\u2193',x,gy-12,p.compact?36:24,'#176a49','center');
                }}
            }
            const skierY=y(285),x=150+s.lane*210;
            p.line([[40,skierY],[680,skierY]],'#b0c6d2',1,[3,7]);
            const color=s.time<s.recoveryUntil?'#bf3535':s.time-s.movedAt<.25?'#176a49':C.blue;
            p.line([[x-13,skierY+21],[x-17,skierY+40]],'#444',3);p.line([[x+8,skierY+20],[x+14,skierY+40]],'#444',3);
            p.circle(x,skierY-5,7,'#e9ae76');p.line([[x,skierY+2],[x,skierY+20]],color,7);p.line([[x-16,skierY+15],[x,skierY+6],[x+17,skierY+15]],color,4);

        }
    });
}
