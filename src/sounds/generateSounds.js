const fs = require('fs');
const path = require('path');
const SAMPLE_RATE = 44100;

function writeWav(filename, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n*2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20);
  buf.writeUInt16LE(1,22); buf.writeUInt32LE(SAMPLE_RATE,24);
  buf.writeUInt32LE(SAMPLE_RATE*2,28); buf.writeUInt16LE(2,32); buf.writeUInt16LE(16,34);
  buf.write('data',36); buf.writeUInt32LE(n*2,40);
  for (let i=0;i<n;i++) buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  fs.writeFileSync(filename, buf);
  console.log('✅ Written:', filename);
}

function env(t,a,d,s,r,dur){
  if(t<a) return t/a;
  if(t<a+d) return 1-(1-s)*(t-a)/d;
  if(t<dur-r) return s;
  return s*(1-(t-(dur-r))/r);
}

const outDir = path.join(__dirname,'../../assets/sounds');
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

// beep
(()=>{const dur=0.12,n=Math.floor(SAMPLE_RATE*dur),s=new Float32Array(n);
for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,e=env(t,.005,.02,.6,.05,dur);
s[i]=e*(0.6*Math.sin(2*Math.PI*880*t)+0.3*Math.sin(2*Math.PI*1320*t));}
writeWav(path.join(outDir,'beep.wav'),s);})();

// ding
(()=>{const dur=0.55,n=Math.floor(SAMPLE_RATE*dur),s=new Float32Array(n);
for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,e=env(t,.01,.08,.4,.25,dur);
const b=t<0.25?1:Math.max(0,1-(t-0.25)/0.1);
s[i]=e*(b*0.7*Math.sin(2*Math.PI*659.25*t)+(1-b*0.3)*0.5*Math.sin(2*Math.PI*987.77*t));}
writeWav(path.join(outDir,'ding.wav'),s);})();

// datastream
(()=>{const dur=0.35,n=Math.floor(SAMPLE_RATE*dur),s=new Float32Array(n);
for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,e=env(t,.01,.05,.5,.1,dur);
const sw=440*(1+1.5*(t/dur));
s[i]=e*(0.4*Math.sin(2*Math.PI*sw*t)+0.3*Math.sin(2*Math.PI*sw*1.5*t));}
writeWav(path.join(outDir,'datastream.wav'),s);})();

// error
(()=>{const dur=0.28,n=Math.floor(SAMPLE_RATE*dur),s=new Float32Array(n);
for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,e=env(t,.005,.03,.5,.1,dur);
const f=600*Math.pow(0.4,t/dur);
s[i]=e*(0.5*Math.sin(2*Math.PI*f*t)+0.3*Math.sin(2*Math.PI*f*0.75*t));}
writeWav(path.join(outDir,'error.wav'),s);})();

// powerup
(()=>{const dur=0.9,n=Math.floor(SAMPLE_RATE*dur),s=new Float32Array(n);
const notes=[261.63,329.63,392.00,523.25];
for(let i=0;i<n;i++){const t=i/SAMPLE_RATE;
const ni=Math.min(3,Math.floor(t/(dur/4)));
const nt=t-ni*(dur/4),e=env(nt,.02,.05,.5,.1,dur/4);
s[i]=e*(0.5*Math.sin(2*Math.PI*notes[ni]*t)+0.25*Math.sin(2*Math.PI*notes[ni]*2*t));}
writeWav(path.join(outDir,'powerup.wav'),s);})();

// pause
(()=>{const dur=0.1,n=Math.floor(SAMPLE_RATE*dur),s=new Float32Array(n);
for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,e=env(t,.003,.015,.4,.04,dur);
s[i]=e*(0.7*Math.sin(2*Math.PI*660*t)+0.3*Math.sin(2*Math.PI*990*t));}
writeWav(path.join(outDir,'pause.wav'),s);})();

console.log('\n🖖 All LCARS sounds generated!');
