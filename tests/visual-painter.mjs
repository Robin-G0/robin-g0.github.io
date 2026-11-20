/** A canvas stand-in that records fills, so tests can see what a frame paints. */
export function recordingPainter(colors={},h=420,compact=false) {
    const fills=[];
    const gradient={addColorStop(){}};
    const context=new Proxy({fills,createRadialGradient:()=>gradient,measureText:text=>({width:String(text).length*12}),
        fillRect(...args){fills.push(['fillRect',this.fillStyle,...args]);},fillText(text){fills.push(['text',this.fillStyle,text]);},
        fill(){fills.push(['fill',this.fillStyle]);},roundRect(){},save(){},restore(){}},{
        get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
    const painter={c:context,colors,w:720,h,compact,
        color:value=>colors[value]||value,
        rect(x,y,w,height,color){context.fillStyle=painter.color(color);context.fills.push(['rect',context.fillStyle,x,y,w,height]);},
        outline(){},line(){},circle(){},text(text,x,y,size,color){context.fills.push(['label',painter.color(color),String(text),x,y,size]);}};
    return painter;
}

