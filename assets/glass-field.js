// Glass / Fluent (2020-2026): a live field of liquid light behind the portfolio.
// One WebGL fragment shader (domain-warped noise in an iridescent palette, a soft light
// that follows the pointer), drawn at low resolution and capped at 30 frames a second.
// It stops while the tab is hidden, while a game is open and outside the Glass theme;
// with reduced motion it draws a single still frame. Without WebGL the CSS gradient stays.

const VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAGMENT = `precision mediump float;
uniform vec2 res;uniform float t;uniform vec2 pointer;uniform float glow;
uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;uniform vec3 light;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*res)/res.y;
  float s=t*.03;
  vec2 q=vec2(fbm(p*1.5+s),fbm(p*1.5-s+3.1));
  vec2 r=vec2(fbm(p*1.25+2.*q+vec2(1.7,9.2)+s*1.4),fbm(p*1.25+2.*q+vec2(8.3,2.8)-s));
  float f=fbm(p*1.15+2.3*r);
  vec3 col=mix(c0,c1,smoothstep(.15,.85,f));
  col=mix(col,c2,smoothstep(.5,1.,length(q))*.85);
  col=mix(col,c3,smoothstep(.55,.95,r.x)*.75);
  float sheen=pow(.5+.5*sin(f*14.+r.y*6.+t*.25),6.);
  col+=light*sheen*.07;
  vec2 pp=(pointer*res-.5*res)/res.y;float d=length(p-pp);
  col+=light*glow*exp(-d*d*7.);
  float v=length((gl_FragCoord.xy/res)-.5);col*=1.-.18*smoothstep(.45,.85,v);
  gl_FragColor=vec4(col,1.);
}`;

const PALETTES = {
    dark: { c0: '#050a1d', c1: '#172867', c2: '#5a35b5', c3: '#118fb5', light: '#bfe3ff', glow: .16 },
    light: { c0: '#eef1fc', c1: '#d6ddfb', c2: '#f4d5ef', c3: '#c6edf4', light: '#ffffff', glow: .22 }
};
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader');
    return shader;
}

/** Mounts the field in `.ambient` and the pointer light on panels; returns { dispose }. */
export function mountGlassField(root = document.documentElement) {
    const host = document.querySelector('.ambient');
    const canvas = document.createElement('canvas');
    canvas.className = 'glass-field'; canvas.setAttribute('aria-hidden', 'true');
    host?.prepend(canvas);
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const abort = new AbortController(), signal = abort.signal;
    let frame = 0, last = 0, start = performance.now(), drawn = false;
    const pointer = { x: .7, y: .65, tx: .7, ty: .65 };
    let program = null, uniforms = null;

    if (gl) {
        try {
            program = gl.createProgram();
            gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
            gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
            gl.linkProgram(program); gl.useProgram(program);
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const at = gl.getAttribLocation(program, 'p');
            gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
            uniforms = Object.fromEntries(['res', 't', 'pointer', 'glow', 'c0', 'c1', 'c2', 'c3', 'light']
                .map(name => [name, gl.getUniformLocation(program, name)]));
        } catch { program = null; }
    }
    if (!program) canvas.remove(); else root.dataset.glassField = 'live';

    function resize() {
        if (!program) return;
        const scale = Math.min(.45, 900 / Math.max(innerWidth, 1));
        const width = Math.max(1, Math.round(innerWidth * scale)), height = Math.max(1, Math.round(innerHeight * scale));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; drawn = false; }
        gl.viewport(0, 0, width, height);
    }
    function draw(now) {
        const palette = PALETTES[root.dataset.mode === 'dark' ? 'dark' : 'light'];
        pointer.x += (pointer.tx - pointer.x) * .06; pointer.y += (pointer.ty - pointer.y) * .06;
        gl.uniform2f(uniforms.res, canvas.width, canvas.height);
        gl.uniform1f(uniforms.t, reduced.matches ? 40 : (now - start) / 1000);
        gl.uniform2f(uniforms.pointer, pointer.x, 1 - pointer.y);
        gl.uniform1f(uniforms.glow, palette.glow);
        for (const key of ['c0', 'c1', 'c2', 'c3', 'light']) gl.uniform3fv(uniforms[key], rgb(palette[key]));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        drawn = true;
    }
    const running = () => program && root.dataset.theme === 'glass' && !root.dataset.arcadeOpen && !document.hidden;
    function loop(now) {
        frame = 0;
        if (!running()) { canvas.dataset.running = 'false'; return; }
        canvas.dataset.running = reduced.matches ? 'still' : 'true';
        if (reduced.matches) { if (!drawn) draw(now); return; }
        if (now - last >= 33) { last = now; draw(now); }
        frame = requestAnimationFrame(loop);
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };

    // Pointer: the field's light eases toward it; panels get a specular highlight where it is.
    let latest = null, scheduled = false;
    addEventListener('pointermove', event => {
        pointer.tx = event.clientX / innerWidth; pointer.ty = event.clientY / innerHeight;
        latest = event;
        if (scheduled || root.dataset.theme !== 'glass') return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            root.style.setProperty('--gl-px', `${latest.clientX}px`);
            root.style.setProperty('--gl-py', `${latest.clientY}px`);
            const panel = latest.target?.closest?.('.scene, .journey, .gesture-demo, .metrics > div, .project-list a');
            if (!panel) return;
            const box = panel.getBoundingClientRect();
            panel.style.setProperty('--mx', `${latest.clientX - box.left}px`);
            panel.style.setProperty('--my', `${latest.clientY - box.top}px`);
        });
    }, { signal, passive: true });
    addEventListener('resize', () => { resize(); wake(); }, { signal });
    document.addEventListener('visibilitychange', wake, { signal });
    reduced.addEventListener('change', () => { drawn = false; wake(); }, { signal });
    const observer = new MutationObserver(() => { drawn = false; wake(); });
    observer.observe(root, { attributes: true, attributeFilter: ['data-mode', 'data-arcade-open', 'data-theme'] });

    resize(); wake();
    return {
        dispose() {
            abort.abort(); observer.disconnect(); cancelAnimationFrame(frame);
            canvas.remove(); delete root.dataset.glassField;
            root.style.removeProperty('--gl-px'); root.style.removeProperty('--gl-py');
            gl?.getExtension('WEBGL_lose_context')?.loseContext();
        }
    };
}
