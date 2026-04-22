import { useState, useEffect, useRef, useCallback } from "react";

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const sv = (k,v) => { try { localStorage.setItem("n_"+k, JSON.stringify(v)); } catch {} };
const ld = (k,d) => { try { const v=localStorage.getItem("n_"+k); return v?JSON.parse(v):d; } catch { return d; } };
const todayStr = () => new Date().toISOString().slice(0,10);
const timeStr  = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtTimer = s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const pct = (v,m) => Math.min(Math.round((v/m)*100),100);

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  coral:"#FF6B6B",mint:"#4ECDC4",sun:"#FFE66D",ocean:"#4A90D9",
  grape:"#C77DFF",lime:"#A8E063",orange:"#FF9A3C",
  bg:"#0A0A0A",card:"#141414",card2:"#1C1C1C",
  border:"#252525",text:"#F2F2F2",muted:"#666",
};

// ─── NIGERIAN FOOD DATABASE ───────────────────────────────────────────────────
const NIGERIAN_FOODS = [
  {name:"Jollof Rice (1 cup)",       cal:350,p:7,c:68,f:6,fi:2},
  {name:"Egusi Soup (1 serving)",    cal:420,p:18,c:12,f:32,fi:4},
  {name:"Fufu (2 wraps)",            cal:280,p:2,c:68,f:0,fi:3},
  {name:"Eba / Garri (medium)",      cal:260,p:2,c:63,f:0,fi:2},
  {name:"Pounded Yam (medium)",      cal:300,p:3,c:72,f:0,fi:4},
  {name:"Suya (100g)",               cal:220,p:28,c:4,f:10,fi:0},
  {name:"Pepper Soup (1 bowl)",      cal:180,p:22,c:5,f:7,fi:1},
  {name:"Moi Moi (1 wrap)",          cal:190,p:12,c:22,f:6,fi:3},
  {name:"Akara (3 pieces)",          cal:210,p:10,c:24,f:9,fi:4},
  {name:"Ogbono Soup (1 serving)",   cal:390,p:16,c:10,f:30,fi:3},
  {name:"Banga Soup (1 serving)",    cal:360,p:14,c:8,f:28,fi:2},
  {name:"Ofada Rice (1 cup)",        cal:340,p:7,c:72,f:3,fi:3},
  {name:"Puff Puff (3 pieces)",      cal:280,p:4,c:38,f:12,fi:1},
  {name:"Chin Chin (handful)",       cal:320,p:5,c:44,f:14,fi:1},
  {name:"Ofe Onugbu (1 serving)",    cal:350,p:15,c:9,f:26,fi:5},
  {name:"Afang Soup (1 serving)",    cal:380,p:17,c:8,f:29,fi:6},
  {name:"Okra Soup (1 serving)",     cal:200,p:12,c:14,f:12,fi:5},
  {name:"Vegetable Soup (1 serving)",cal:220,p:14,c:10,f:14,fi:6},
  {name:"Fried Plantain (6 slices)", cal:270,p:2,c:58,f:5,fi:3},
  {name:"Boiled Plantain (6 slices)",cal:200,p:2,c:52,f:0,fi:3},
  {name:"Rice & Stew (1 plate)",     cal:480,p:18,c:72,f:14,fi:3},
  {name:"Nkwobi (1 serving)",        cal:310,p:24,c:6,f:20,fi:1},
  {name:"Asun (100g)",               cal:230,p:26,c:3,f:12,fi:0},
  {name:"Tuwo Shinkafa (medium)",    cal:290,p:4,c:68,f:1,fi:1},
  {name:"Miyan Kuka (1 bowl)",       cal:160,p:8,c:12,f:8,fi:4},
  {name:"Masa (3 pieces)",           cal:240,p:5,c:46,f:5,fi:2},
  {name:"Boli (1 medium)",           cal:180,p:2,c:48,f:0,fi:3},
  {name:"Efo Riro (1 serving)",      cal:260,p:16,c:8,f:18,fi:5},
  {name:"Catfish Pepper Soup",       cal:200,p:28,c:4,f:8,fi:1},
  {name:"Goat Meat (100g grilled)",  cal:190,p:27,c:0,f:9,fi:0},
];

// ─── FONTS & ANIMATIONS ───────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
  @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  ::-webkit-scrollbar{display:none}
  button:active{transform:scale(0.96)}
  input,select,button{font-family:'DM Sans',sans-serif;outline:none}
  body{margin:0;background:#0A0A0A}
`;

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────
function Pill({children,color,sm}) {
  return <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:99,padding:sm?"2px 7px":"3px 10px",fontSize:sm?10:12,fontWeight:700,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{children}</span>;
}
function Card({children,style={},glow}) {
  return <div style={{background:C.card,borderRadius:18,padding:16,border:`1px solid ${glow?glow+"55":C.border}`,boxShadow:glow?`0 0 24px ${glow}18`:"none",marginBottom:12,...style}}>{children}</div>;
}
function Sec({children}) {
  return <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:10,marginTop:2}}>{children}</div>;
}
function Btn({children,onClick,color=C.coral,outline,full,sm,disabled,style={}}) {
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",background:outline?"transparent":color,color:outline?color:"#111",border:`1.5px solid ${color}`,borderRadius:99,padding:sm?"7px 16px":"11px 24px",fontSize:sm?12:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",opacity:disabled?.5:1,transition:"all .2s",...style}}>{children}</button>;
}
function Field({label,value,onChange,type="text",placeholder,style={}}) {
  return <div style={{marginBottom:11,...style}}>
    {label && <div style={{fontSize:10,color:C.muted,marginBottom:4,fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>}
    <input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 14px",color:C.text,fontSize:14}}/>
  </div>;
}
function Ring({value,max,color,size=100,stroke=9,children}) {
  const r=(size-stroke)/2,circ=2*Math.PI*r,p=Math.min(value/max,1);
  return <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${p*circ} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray .8s ease"}}/>
    </svg>
    <div style={{position:"absolute",textAlign:"center"}}>{children}</div>
  </div>;
}
function MBar({label,value,max,color,unit="g"}) {
  const p=pct(value,max);
  return <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
      <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{label}</span>
      <span style={{fontSize:12,color:C.text,fontFamily:"'DM Mono',monospace"}}>{value}{unit}/{max}{unit}</span>
    </div>
    <div style={{background:C.border,borderRadius:99,height:8,overflow:"hidden"}}>
      <div style={{width:`${p}%`,background:p>=100?"#FF4444":color,height:"100%",borderRadius:99,transition:"width .6s ease"}}/>
    </div>
  </div>;
}

// ─── AI RESULT CARD ───────────────────────────────────────────────────────────
function AiCard({result,image,onAdd}) {
  return <div style={{background:C.card2,borderRadius:14,padding:14,border:`1px solid ${C.mint}44`,marginTop:10,animation:"slideIn .3s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{fontWeight:700,fontSize:15,fontFamily:"'Syne',sans-serif"}}>{result.name}</div>
      <Pill color={result.confidence==="high"?C.mint:result.confidence==="medium"?C.sun:C.coral} sm>{result.confidence}</Pill>
    </div>
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
      <Pill color={C.coral}>{result.calories}kcal</Pill>
      <Pill color={C.ocean}>{result.protein}g P</Pill>
      <Pill color={C.sun}>{result.carbs}g C</Pill>
      <Pill color={C.lime}>{result.fat}g F</Pill>
      <Pill color={C.grape}>{result.fibre}g fibre</Pill>
      {result.isProcessed && <Pill color={C.coral}>processed</Pill>}
    </div>
    {result.notes && <div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:10}}>{result.notes}</div>}
    <Btn full color={C.mint} onClick={()=>onAdd({...result,image})}>✓ Add to Log</Btn>
  </div>;
}

// ─── WEIGHT TREND CHART ───────────────────────────────────────────────────────
function WeightChart({entries}) {
  if(entries.length<2) return <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Log at least 2 weight entries to see your trend</div>;
  const w=320,h=140,pad=30;
  const vals=entries.map(e=>e.weight);
  const minV=Math.min(...vals)-1, maxV=Math.max(...vals)+1;
  const x=(i)=>pad+(i/(entries.length-1))*(w-pad*2);
  const y=(v)=>h-pad-((v-minV)/(maxV-minV))*(h-pad*2);
  // trend line (simple linear regression)
  const n=entries.length;
  const mx=entries.reduce((a,_,i)=>a+i,0)/n;
  const my=vals.reduce((a,v)=>a+v,0)/n;
  const slope=entries.reduce((a,_,i)=>a+(i-mx)*(vals[i]-my),0)/entries.reduce((a,_,i)=>a+(i-mx)**2,0);
  const intercept=my-slope*mx;
  const trendY=(i)=>y(intercept+slope*i);
  const pathD=entries.map((_,i)=>`${i===0?"M":"L"}${x(i)},${y(vals[i])}`).join(" ");
  const trendD=`M${x(0)},${trendY(0)} L${x(n-1)},${trendY(n-1)}`;
  const latest=vals[vals.length-1];
  const change=vals.length>=2?+(latest-vals[0]).toFixed(1):0;
  return <div>
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{overflow:"visible"}}>
      <polyline points={entries.map((_,i)=>`${x(i)},${y(vals[i])}`).join(" ")} fill="none" stroke={C.ocean} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1={x(0)} y1={trendY(0)} x2={x(n-1)} y2={trendY(n-1)} stroke={C.coral} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.8"/>
      {entries.map((_,i)=><circle key={i} cx={x(i)} cy={y(vals[i])} r="4" fill={C.ocean} stroke={C.bg} strokeWidth="2"/>)}
      {[minV+1,my,maxV-1].map(v=><text key={v} x={pad-4} y={y(v)+4} fontSize="9" fill={C.muted} textAnchor="end">{v.toFixed(1)}</text>)}
      {entries.filter((_,i)=>i===0||i===n-1||i===Math.floor(n/2)).map((e,_,arr,i=entries.indexOf(e))=><text key={i} x={x(i)} y={h-4} fontSize="9" fill={C.muted} textAnchor="middle">{e.date.slice(5)}</text>)}
    </svg>
    <div style={{display:"flex",gap:12,marginTop:8}}>
      <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>CURRENT</div>
        <div style={{fontSize:18,fontWeight:800,color:C.ocean,fontFamily:"'Syne',sans-serif"}}>{latest}<span style={{fontSize:11,color:C.muted}}>kg</span></div>
      </div>
      <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px",border:`1px solid ${change<=0?C.mint:C.coral}33`}}>
        <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>CHANGE</div>
        <div style={{fontSize:18,fontWeight:800,color:change<=0?C.mint:C.coral,fontFamily:"'Syne',sans-serif"}}>{change>0?"+":""}{change}<span style={{fontSize:11,color:C.muted}}>kg</span></div>
      </div>
      <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>TREND</div>
        <div style={{fontSize:14,fontWeight:700,color:slope<0?C.mint:slope>0?C.coral:C.sun}}>{slope<-0.05?"↓ Losing":slope>0.05?"↑ Gaining":"→ Stable"}</div>
      </div>
    </div>
  </div>;
}

// ─── WEEKLY CHECKIN ───────────────────────────────────────────────────────────
function WeeklyCheckin({onAccept,onDecline,currentGoals}) {
  const suggested = {
    calories: Math.max(1400, currentGoals.calories - 50),
    protein: currentGoals.protein,
    fat: currentGoals.fat,
    carbs: Math.max(100, currentGoals.carbs - 10),
  };
  const days = ["M","T","W","T","F","S","S"];
  return <div style={{animation:"slideIn .3s ease"}}>
    <div style={{fontWeight:800,fontSize:22,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Weekly Check-In</div>
    <div style={{fontSize:13,color:C.muted,marginBottom:18}}>Review your programme adjustments</div>
    <Card>
      <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4}}>
        {days.map((d,i)=>{
          const isHigh=i===4||i===5;
          return <div key={i} style={{flex:1,minWidth:38,display:"flex",flexDirection:"column",gap:4}}>
            {[{v:isHigh?suggested.calories+248:suggested.calories,c:"#A8B8FF"},{v:suggested.protein,c:"#FFB3B3"},{v:isHigh?suggested.fat+10:suggested.fat,c:"#FFE0A0"},{v:isHigh?suggested.carbs+40:suggested.carbs,c:"#B3EFD4"}].map(({v,c},j)=>(
              <div key={j} style={{background:c+"33",border:`1px solid ${c}66`,borderRadius:8,padding:"6px 4px",textAlign:"center",fontSize:j===0?11:10,fontWeight:700,color:C.text}}>{j===0?v:`${v}${j===1?"P":j===2?"F":"C"}`}</div>
            ))}
            <div style={{textAlign:"center",fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{d}</div>
          </div>;
        })}
      </div>
    </Card>
    <Card glow={C.mint}>
      <Sec>How your programme was updated</Sec>
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:C.mint,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#111",flexShrink:0}}>1</div>
        <div><div style={{fontWeight:700,fontSize:14}}>Average Change</div><div style={{color:C.mint,fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace"}}>{suggested.calories-currentGoals.calories} kcal</div><div style={{fontSize:12,color:C.muted}}>Your daily average calories will adjust</div></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:C.ocean,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>2</div>
        <div><div style={{fontWeight:700,fontSize:14}}>Carb Adjustment</div><div style={{color:C.ocean,fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace"}}>{suggested.carbs-currentGoals.carbs}g carbs</div><div style={{fontSize:12,color:C.muted}}>Slight reduction on rest days</div></div>
      </div>
    </Card>
    <div style={{display:"flex",gap:10}}>
      <Btn full outline color={C.muted} onClick={onDecline}>Decline</Btn>
      <Btn full color={C.mint} onClick={()=>onAccept(suggested)}>Accept Changes</Btn>
    </div>
  </div>;
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({onDone}) {
  const [step,setStep]=useState(0);
  const [p,setP]=useState({name:"",age:"",weight:"",goal:"lose",schedule:"shifts",sleepTime:"23:00",stressLevel:3,culturalFoods:"Nigerian",budget:"medium",triggers:[],calorieGoal:2000,waterGoal:8});
  const set=k=>v=>setP(prev=>({...prev,[k]:v}));
  const STEPS=[
    {title:"Welcome to Nourish 🌱",sub:"2 minutes to set up. Built around your actual life.",body:<>
      <Field label="Your first name" value={p.name} onChange={set("name")} placeholder="e.g. Samuel"/>
      <div style={{display:"flex",gap:10}}><Field label="Age" value={p.age} onChange={set("age")} type="number" placeholder="28" style={{flex:1}}/><Field label="Weight (kg)" value={p.weight} onChange={set("weight")} type="number" placeholder="85" style={{flex:1}}/></div>
    </>},
    {title:"Your Work Life 💼",sub:"Shift workers and 9-to-5 workers need different strategies.",body:<>
      <Sec>Work Schedule</Sec>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
        {[["shifts","Shift / Nights"],["nine5","9–5"],["freelance","Freelance"],["remote","Remote"]].map(([v,l])=><button key={v} onClick={()=>setP(prev=>({...prev,schedule:v}))} style={{background:p.schedule===v?C.mint+"22":"transparent",color:p.schedule===v?C.mint:C.muted,border:`1px solid ${p.schedule===v?C.mint:C.border}`,borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>)}
      </div>
      <Field label="Usual sleep time" value={p.sleepTime} onChange={set("sleepTime")} type="time"/>
      <Sec>Average Stress Level</Sec>
      <div style={{display:"flex",gap:8}}>
        {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setP(prev=>({...prev,stressLevel:n}))} style={{width:44,height:44,borderRadius:"50%",border:`1px solid ${p.stressLevel>=n?C.coral:C.border}`,background:p.stressLevel>=n?C.coral+"22":"transparent",color:p.stressLevel>=n?C.coral:C.muted,fontWeight:700,fontSize:15,cursor:"pointer"}}>{n}</button>)}
      </div>
    </>},
    {title:"Your Food Culture 🍲",sub:"We include Nigerian and West African foods in our database.",body:<>
      <Field label="Cultural foods you eat regularly" value={p.culturalFoods} onChange={set("culturalFoods")} placeholder="Jollof rice, egusi, suya, puff puff..."/>
      <Sec>Weekly Food Budget</Sec>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["tight","< £30"],["medium","£30–60"],["flexible","£60+"]].map(([v,l])=><button key={v} onClick={()=>setP(prev=>({...prev,budget:v}))} style={{flex:1,background:p.budget===v?C.sun+"22":"transparent",color:p.budget===v?C.sun:C.muted,border:`1px solid ${p.budget===v?C.sun:C.border}`,borderRadius:12,padding:"9px 0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>)}
      </div>
      <Sec>Emotional Triggers</Sec>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {["Stress","Boredom","Late nights","After work","Loneliness","Anxiety","Celebrations"].map(t=><button key={t} onClick={()=>setP(prev=>({...prev,triggers:prev.triggers.includes(t)?prev.triggers.filter(x=>x!==t):[...prev.triggers,t]}))} style={{background:p.triggers.includes(t)?C.grape+"22":"transparent",color:p.triggers.includes(t)?C.grape:C.muted,border:`1px solid ${p.triggers.includes(t)?C.grape:C.border}`,borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{t}</button>)}
      </div>
    </>},
    {title:"Your Goals 🎯",sub:"We adapt these weekly based on your progress.",body:<>
      <Sec>Primary Goal</Sec>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["lose","Lose weight"],["maintain","Maintain"],["gain","Build muscle"]].map(([v,l])=><button key={v} onClick={()=>setP(prev=>({...prev,goal:v}))} style={{flex:1,background:p.goal===v?C.coral+"22":"transparent",color:p.goal===v?C.coral:C.muted,border:`1px solid ${p.goal===v?C.coral:C.border}`,borderRadius:12,padding:"9px 0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>)}
      </div>
      <Field label="Daily calorie goal" value={p.calorieGoal} onChange={v=>setP(prev=>({...prev,calorieGoal:+v}))} type="number" placeholder="2000"/>
      <Field label="Daily water goal (glasses)" value={p.waterGoal} onChange={v=>setP(prev=>({...prev,waterGoal:+v}))} type="number" placeholder="8"/>
      <div style={{background:C.card2,borderRadius:12,padding:12,fontSize:12,color:C.muted,border:`1px solid ${C.border}`}}>
        Suggested: <span style={{color:C.coral,fontWeight:700}}>{p.goal==="lose"?Math.max(1400,p.calorieGoal-400):p.goal==="gain"?p.calorieGoal+300:p.calorieGoal} kcal</span> on rest days. We'll adjust weekly based on your results.
      </div>
    </>},
  ];
  const curr=STEPS[step];
  return <div style={{minHeight:"100vh",background:C.bg,padding:24,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
    <style>{CSS}</style>
    <div style={{flex:1,maxWidth:440,margin:"0 auto",width:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",gap:6,marginBottom:28,marginTop:8}}>
        {STEPS.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:99,background:i<=step?C.coral:C.border,transition:"background .3s"}}/>)}
      </div>
      <div style={{fontSize:24,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4,color:C.text}}>{curr.title}</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:22}}>{curr.sub}</div>
      <div style={{flex:1}}>{curr.body}</div>
      <div style={{display:"flex",gap:10,marginTop:24,paddingBottom:16}}>
        {step>0 && <Btn outline color={C.muted} onClick={()=>setStep(s=>s-1)}>Back</Btn>}
        <Btn full color={C.coral} onClick={()=>step<STEPS.length-1?setStep(s=>s+1):onDone(p)}>{step<STEPS.length-1?"Continue →":"Get Started 🚀"}</Btn>
      </div>
    </div>
  </div>;
}

// ─── VOICE HOOK ───────────────────────────────────────────────────────────────
function useVoice(onResult) {
  const [listening,setListening]=useState(false);
  const ref=useRef(null);
  const start=useCallback(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Voice not supported on this browser. Try Chrome.");return;}
    const r=new SR();r.lang="en-GB";r.interimResults=false;
    r.onresult=e=>{onResult(e.results[0][0].transcript);setListening(false);};
    r.onend=()=>setListening(false);
    r.start();ref.current=r;setListening(true);
  },[onResult]);
  const stop=useCallback(()=>{ref.current?.stop();setListening(false);},[]);
  return {listening,start,stop};
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const DEFAULT_GOALS={calories:2000,protein:150,carbs:200,fat:65,fibre:30,water:8};
const MOODS=["😫","😔","😐","🙂","😄"];
const HUNGER_L=["Not hungry","A little","Moderate","Hungry","Very hungry"];

// API call — goes through /api/analyse proxy to avoid CORS
// The Vercel serverless function at /api/analyse adds the API key server-side
const callProxy = async (messages, maxTokens=1000) => {
  const res = await fetch("/api/analyse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export default function App() {
  const [hasProfile,setHP] = useState(()=>!!ld("profile",null));
  const [profile,setPro]   = useState(()=>ld("profile",null));
  const [tab,setTab]       = useState("home");
  const [foodLog,setFL]    = useState(()=>ld("log_"+todayStr(),[]));
  const [water,setWater]   = useState(()=>ld("water_"+todayStr(),0));
  const [fast,setFast]     = useState(()=>ld("fast",{active:false,start:null,window:16,eat:8,shiftMode:false,shiftStart:null}));
  const [fastEl,setFastEl] = useState(0);
  const [moodLog,setML]    = useState(()=>ld("moods",[]));
  const [weights,setWts]   = useState(()=>ld("weights",[]));
  const [goals,setGoals]   = useState(()=>ld("goals",{...DEFAULT_GOALS}));
  const [now,setNow]       = useState(new Date());

  // Overlays
  const [badDay,setBD]       = useState(false);
  const [crave,setCrave]     = useState(false);
  const [craveType,setCT]    = useState(null);
  const [postMeal,setPM]     = useState(null);
  const [hungerB,setHB]      = useState(2);
  const [moodB,setMB]        = useState(2);
  const [moodA,setMA]        = useState(3);
  const [showCheckin,setSCI] = useState(false);
  const [showWeight,setSW]   = useState(false);
  const [newWeight,setNW]    = useState("");

  // Log form
  const [uploadImg,setUI]   = useState(null);
  const [uploadData,setUD]  = useState(null);
  const [aiResult,setAR]    = useState(null);
  const [aiErr,setAE]       = useState(null);
  const [analyzing,setANZ]  = useState(false);
  const [voiceText,setVT]   = useState("");
  const [manual,setMan]     = useState({name:"",calories:"",protein:"",carbs:"",fat:"",fibre:""});
  const [mealType,setMT]    = useState("Lunch");
  const [nigerSearch,setNS] = useState("");
  const [logMode,setLM]     = useState("photo"); // photo|voice|manual|nigerian|barcode
  const [scanActive,setScan]= useState(false);
  const [coachMsg,setCM]    = useState("");
  const [coachLoad,setCL]   = useState(false);
  const fileRef=useRef();
  const videoRef=useRef();
  const scanRef=useRef();

  // Persist
  useEffect(()=>sv("log_"+todayStr(),foodLog),[foodLog]);
  useEffect(()=>sv("water_"+todayStr(),water),[water]);
  useEffect(()=>sv("fast",fast),[fast]);
  useEffect(()=>sv("moods",moodLog),[moodLog]);
  useEffect(()=>sv("weights",weights),[weights]);
  useEffect(()=>sv("goals",goals),[goals]);

  // Clock
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  // Fast timer
  useEffect(()=>{
    if(!fast.active||!fast.start) return;
    const t=setInterval(()=>setFastEl(Math.floor((Date.now()-fast.start)/1000)),1000);
    return()=>clearInterval(t);
  },[fast.active,fast.start]);

  // Weekly checkin prompt (every 7 days)
  useEffect(()=>{
    const lastCI=ld("lastCheckin",null);
    if(!lastCI||Date.now()-lastCI>7*24*3600*1000) { if(weights.length>0||foodLog.length>3) setSCI(true); }
  },[]);

  const totals=foodLog.reduce((a,f)=>({calories:a.calories+f.calories,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat,fibre:a.fibre+f.fibre}),{calories:0,protein:0,carbs:0,fat:0,fibre:0});
  const remaining=Math.max(goals.calories-totals.calories,0);
  const over=totals.calories>goals.calories;
  const fastProg=fast.window>0?Math.min(fastEl/(fast.window*3600),1):0;
  const procPct=foodLog.length?Math.round((foodLog.filter(f=>f.isProcessed).length/foodLog.length)*100):0;
  const fastEndTime=fast.start?new Date(fast.start+fast.window*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"--:--";
  const eatEndTime=fast.start?new Date(fast.start+(fast.window+fast.eat)*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"--:--";

  // Shift mode fasting: fast DURING shift, eat AFTER waking
  const shiftFastLabel = fast.shiftMode
    ? `Shift fast started — eating window opens when you wake up`
    : null;

  const addFood=food=>{
    const item={...food,id:Date.now(),time:timeStr(),meal:mealType};
    setFL(p=>[...p,item]);
    setPM({id:item.id,step:"before"});
    setUI(null);setUD(null);setAR(null);setAE(null);setVT("");
    setMan({name:"",calories:"",protein:"",carbs:"",fat:"",fibre:""});
  };

  const delFood=id=>setFL(p=>p.filter(f=>f.id!==id));

  const handleImg=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{setUI(ev.target.result);setUD({base64:ev.target.result.split(",")[1],mediaType:file.type});setAR(null);setAE(null);};
    r.readAsDataURL(file);
  };

  const analyzePhoto=async()=>{
    if(!uploadData)return;
    setANZ(true);setAE(null);
    try {
      const data=await callProxy([{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:uploadData.mediaType,data:uploadData.base64}},
        {type:"text",text:`Analyse this food image. Consider Nigerian/West African dishes if visible. Return ONLY raw JSON (no markdown, no backticks): name (string), calories (number), protein (number,grams), carbs (number,grams), fat (number,grams), fibre (number,grams), sodium (number,mg), sugar (number,grams), confidence ("high"/"medium"/"low"), notes (one sentence), isProcessed (boolean). Be realistic with portions.`}
      ]}]);
      const text=data.content?.find(b=>b.type==="text")?.text||"{}";
      setAR(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){setAE("Couldn't analyse. Check your connection or enter manually.");}
    finally{setANZ(false);}
  };

  const analyzeVoice=async text=>{
    setANZ(true);setAE(null);
    try {
      const data=await callProxy([{role:"user",content:`User described food: "${text}". This may include Nigerian dishes (jollof rice, egusi, fufu, suya etc). Estimate nutrition. Return ONLY raw JSON (no markdown): name, calories (number), protein (grams), carbs (grams), fat (grams), fibre (grams), confidence, notes (one sentence), isProcessed (boolean).`}]);
      const text2=data.content?.find(b=>b.type==="text")?.text||"{}";
      setAR(JSON.parse(text2.replace(/```json|```/g,"").trim()));
    } catch{setAE("Couldn't parse. Enter manually.");}
    finally{setANZ(false);}
  };

  const getCoach=async()=>{
    setCL(true);
    const ctx={calories:totals.calories,goal:goals.calories,water,waterGoal:goals.water,fastActive:fast.active,schedule:profile?.schedule,meals:foodLog.length,triggers:profile?.triggers,moodLog:moodLog.slice(-5),name:profile?.name,weightTrend:weights.length>=2?weights[weights.length-1].weight-weights[0].weight:null};
    try {
      const data=await callProxy([{role:"user",content:`You are a warm, psychologically-informed nutrition coach for ${ctx.name||"this person"} who works ${ctx.schedule||"shifts"} and eats Nigerian/West African food. Data: ${JSON.stringify(ctx)}. Give ONE short personalised insight or nudge (2–3 sentences). Warm, specific, not preachy. Plain text only.`}],300);
      setCM(data.content?.find(b=>b.type==="text")?.text||"Keep logging — patterns emerge over time.");
    } catch{setCM("Keep logging — patterns emerge over time. You're building something real.");}
    finally{setCL(false);}
  };

  const voice=useVoice(text=>{setVT(text);analyzeVoice(text);});

  const saveMood=()=>{
    setML(p=>[...p,{date:todayStr(),time:timeStr(),moodBefore:moodB,hungerBefore:hungerB,moodAfter:moodA,foodId:postMeal?.id}]);
    setPM(null);
  };

  const addWeight=()=>{
    if(!newWeight)return;
    setWts(p=>[...p,{date:todayStr(),weight:+newWeight}].sort((a,b)=>a.date.localeCompare(b.date)));
    setNW("");setSW(false);
  };

  const nigerFiltered=NIGERIAN_FOODS.filter(f=>f.name.toLowerCase().includes(nigerSearch.toLowerCase()));

  const CRAVE_MAP={
    hunger:{title:"Real Hunger",color:C.coral,action:"Your body needs fuel — eat a proper meal.",options:[{label:"Find a cafe nearby",action:()=>window.open("https://maps.google.com?q=restaurants+near+me","_blank")},{label:"Rice + any protein",action:null},{label:"Eggs + toast (8 min)",action:null}]},
    boredom:{title:"Boredom",color:C.ocean,action:"Try a 5-min distraction first.",options:[{label:"Walk route nearby 🗺️",action:()=>window.open("https://maps.google.com?q=parks+near+me","_blank")},{label:"Call a friend 📞",action:()=>window.open("tel:","_self")},{label:"Drink water first",action:null}]},
    stress:{title:"Stress",color:C.grape,action:"A small planned snack beats unplanned grazing.",options:[{label:"Handful of nuts",action:null},{label:"Fresh fruit",action:null},{label:"Herbal tea",action:null}]},
    habit:{title:"Habit",color:C.sun,action:"Notice the trigger — then decide consciously.",options:[{label:"Wait 10 minutes",action:null},{label:"Drink water first",action:null},{label:"Small planned snack",action:null}]},
  };

  if(!hasProfile) return <Onboarding onDone={p=>{sv("profile",p);setPro(p);setHP(true);setGoals({...DEFAULT_GOALS,calories:p.calorieGoal||2000,water:p.waterGoal||8});}}/>;

  // ── OVERLAYS ──────────────────────────────────────────────────────────────
  if(badDay) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center",fontFamily:"'DM Sans',sans-serif"}}>
    <style>{CSS}</style>
    <div style={{fontSize:52,marginBottom:16}}>🌧️</div>
    <div style={{fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:6}}>Bad Day Mode</div>
    <div style={{fontSize:13,color:C.muted,marginBottom:28,maxWidth:300}}>No goals. No guilt. Just getting through today.</div>
    {[["💧","Stay hydrated","Water before anything else"],["🍌","Eat something simple","Banana, toast, yoghurt — anything real"],["🚶","5 minutes outside","Walk nearby — even around the block"],["😴","Rest if you can","Sleep resets almost everything"]].map(([icon,t,s])=><div key={t} style={{background:C.card,borderRadius:14,padding:"14px 18px",width:"100%",maxWidth:360,marginBottom:10,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
      <div style={{fontSize:26}}>{icon}</div>
      <div><div style={{fontWeight:700,fontSize:14}}>{t}</div><div style={{fontSize:12,color:C.muted}}>{s}</div></div>
    </div>)}
    <Btn color={C.mint} style={{marginTop:22}} onClick={()=>setBD(false)}>Back to app</Btn>
  </div>;

  if(crave){
    const resp=craveType?CRAVE_MAP[craveType]:null;
    return <div style={{minHeight:"100vh",background:C.bg,padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{maxWidth:440,margin:"0 auto"}}>
        <button onClick={()=>{setCrave(false);setCT(null);}} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",marginBottom:20,fontFamily:"'DM Mono',monospace"}}>← Back</button>
        {!craveType?<>
          <div style={{fontSize:23,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4}}>I feel like snacking 🤔</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:22}}>What's actually going on?</div>
          {[["hunger","🍽️","I'm actually hungry","Stomach empty, low energy"],["boredom","😑","Bored / procrastinating","Nothing to do, restless"],["stress","😤","Stressed or anxious","After a hard shift or difficult moment"],["habit","🔄","Force of habit","I always snack at this time"]].map(([k,icon,l,s])=><button key={k} onClick={()=>setCT(k)} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:10,display:"flex",alignItems:"center",gap:14,cursor:"pointer",color:C.text,textAlign:"left"}}>
            <div style={{fontSize:28}}>{icon}</div>
            <div><div style={{fontWeight:700,fontSize:14}}>{l}</div><div style={{fontSize:12,color:C.muted}}>{s}</div></div>
          </button>)}
        </>:<>
          <div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4,color:resp.color}}>{resp.title}</div>
          <Card glow={resp.color}><div style={{fontSize:14,lineHeight:1.6}}>{resp.action}</div></Card>
          <Sec>Options</Sec>
          {resp.options.map((o,i)=><button key={i} onClick={o.action||undefined} style={{width:"100%",background:C.card2,border:`1px solid ${o.action?resp.color+"44":C.border}`,borderRadius:12,padding:"13px 16px",marginBottom:8,fontSize:14,color:o.action?resp.color:C.text,cursor:o.action?"pointer":"default",textAlign:"left",fontWeight:o.action?700:400}}>
            {o.label}
          </button>)}
          <button onClick={()=>setCT(null)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",marginTop:6,fontFamily:"'DM Mono',monospace"}}>← Try a different answer</button>
        </>}
      </div>
    </div>;
  }

  if(postMeal) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
    <style>{CSS}</style>
    <div style={{maxWidth:400,width:"100%"}}>
      {postMeal.step==="before"?<>
        <div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Before you eat 🍽️</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>15 seconds. Builds real patterns over time.</div>
        <Card><Sec>How hungry are you?</Sec>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {HUNGER_L.map((h,i)=><button key={i} onClick={()=>setHB(i)} style={{flex:1,minWidth:55,background:hungerB===i?C.ocean+"33":"transparent",color:hungerB===i?C.ocean:C.muted,border:`1px solid ${hungerB===i?C.ocean:C.border}`,borderRadius:10,padding:"8px 4px",fontSize:10,fontWeight:600,cursor:"pointer",textAlign:"center"}}>{h}</button>)}
          </div>
        </Card>
        <Card><Sec>Current mood</Sec>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {MOODS.map((m,i)=><button key={i} onClick={()=>setMB(i)} style={{fontSize:28,background:"none",border:`2px solid ${moodB===i?C.grape:C.border}`,borderRadius:"50%",width:50,height:50,cursor:"pointer",transform:moodB===i?"scale(1.2)":"scale(1)",transition:"transform .2s"}}>{m}</button>)}
          </div>
        </Card>
        <Btn full color={C.coral} onClick={()=>setPM({...postMeal,step:"after"})}>Log & Eat →</Btn>
        <button onClick={()=>setPM(null)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",display:"block",margin:"12px auto 0",fontFamily:"'DM Mono',monospace"}}>Skip check-in</button>
      </>:<>
        <div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4}}>After eating 😌</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>How do you feel now?</div>
        <Card><Sec>Mood after eating</Sec>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {MOODS.map((m,i)=><button key={i} onClick={()=>setMA(i)} style={{fontSize:28,background:"none",border:`2px solid ${moodA===i?C.mint:C.border}`,borderRadius:"50%",width:50,height:50,cursor:"pointer",transform:moodA===i?"scale(1.2)":"scale(1)",transition:"transform .2s"}}>{m}</button>)}
          </div>
        </Card>
        <Btn full color={C.mint} onClick={saveMood}>Save Check-in ✓</Btn>
      </>}
    </div>
  </div>;

  if(showCheckin) return <div style={{minHeight:"100vh",background:C.bg,padding:24,fontFamily:"'DM Sans',sans-serif"}}>
    <style>{CSS}</style>
    <div style={{maxWidth:440,margin:"0 auto"}}>
      <button onClick={()=>setSCI(false)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",marginBottom:16,fontFamily:"'DM Mono',monospace"}}>← Skip for now</button>
      <WeeklyCheckin currentGoals={goals} onDecline={()=>{sv("lastCheckin",Date.now());setSCI(false);}} onAccept={newG=>{setGoals(g=>({...g,...newG}));sv("lastCheckin",Date.now());setSCI(false);}}/>
    </div>
  </div>;

  // ── MAIN ──────────────────────────────────────────────────────────────────
  const NAV=[{id:"home",icon:"⬡",label:"Home"},{id:"log",icon:"＋",label:"Log"},{id:"fast",icon:"◎",label:"Fast"},{id:"coach",icon:"✦",label:"Coach"},{id:"insight",icon:"◈",label:"Insight"}];

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:80}}>
    <style>{CSS}</style>

    {/* Header */}
    <div style={{padding:"18px 16px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.bg,zIndex:20}}>
      <div>
        <div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",letterSpacing:-0.5}}><span style={{color:C.coral}}>N</span>ourish</div>
        <div style={{fontSize:11,color:C.muted}}>{now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short"})} · {profile?.name||"You"}</div>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{setCrave(true);setCT(null);}} style={{background:C.grape+"22",border:`1px solid ${C.grape}44`,borderRadius:99,padding:"5px 11px",fontSize:11,color:C.grape,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>craving?</button>
        <button onClick={()=>setBD(true)} style={{background:C.ocean+"22",border:`1px solid ${C.ocean}44`,borderRadius:99,padding:"5px 11px",fontSize:11,color:C.ocean,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>bad day</button>
      </div>
    </div>

    {/* Nav */}
    <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
      {NAV.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.coral:"transparent"}`,color:tab===t.id?C.coral:C.muted,padding:"10px 4px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",display:"flex",flexDirection:"column",alignItems:"center",gap:1,transition:"color .2s"}}>
        <span style={{fontSize:15}}>{t.icon}</span>{t.label}
      </button>)}
    </div>

    <div style={{padding:"14px 16px",animation:"slideIn .3s ease"}}>

      {/* ── HOME ── */}
      {tab==="home" && <>
        <Card glow={over?C.coral:C.sun} style={{display:"flex",alignItems:"center",gap:16}}>
          <Ring value={totals.calories} max={goals.calories} color={over?C.coral:C.sun} size={106} stroke={9}>
            <div><div style={{fontSize:17,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{totals.calories}</div><div style={{fontSize:9,color:C.muted}}>kcal</div></div>
          </Ring>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15,fontFamily:"'Syne',sans-serif",marginBottom:3}}>{over?`${totals.calories-goals.calories} over goal`:`${remaining} remaining`}</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Goal: {goals.calories} kcal</div>
            <div style={{display:"flex",gap:10}}>
              {[{v:water,suf:`/${goals.water}`,l:"water",c:C.ocean},{v:`${totals.fibre}g`,l:"fibre",c:C.grape},{v:fast.active?fmtTimer(fastEl).slice(0,5):"--",l:"fast",c:fast.active?C.mint:C.muted},{v:`${procPct}%`,l:"processed",c:procPct>50?C.coral:C.lime}].map(({v,suf,l,c})=><div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:c,fontFamily:"'Syne',sans-serif"}}>{v}<span style={{fontSize:9,color:C.muted}}>{suf}</span></div>
                <div style={{fontSize:9,color:C.muted}}>{l}</div>
              </div>)}
            </div>
          </div>
        </Card>

        <Card>
          <Sec>Macros</Sec>
          <MBar label="Protein" value={totals.protein} max={goals.protein||150} color={C.ocean}/>
          <MBar label="Carbs"   value={totals.carbs}   max={goals.carbs||200}   color={C.sun}/>
          <MBar label="Fat"     value={totals.fat}     max={goals.fat||65}     color={C.coral}/>
          <MBar label="Fibre"   value={totals.fibre}   max={goals.fibre||30}   color={C.grape}/>
        </Card>

        <Card>
          <Sec>Health Signals</Sec>
          {[["Protein adequacy",pct(totals.protein,goals.protein||150),C.ocean],["Fibre adequacy",pct(totals.fibre,30),C.lime],["Hydration",pct(water,goals.water||8),C.mint],["Whole food ratio",100-procPct,C.sun]].map(([l,v,c])=><div key={l} style={{marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:12,color:C.muted}}>{l}</span>
              <span style={{fontSize:12,color:v>=80?c:v>=50?C.sun:C.coral,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v>=80?"✓ Good":v>=50?"OK":"Low"}</span>
            </div>
            <div style={{background:C.border,borderRadius:99,height:7,overflow:"hidden"}}>
              <div style={{width:`${v}%`,background:v>=80?c:v>=50?C.sun:C.coral,height:"100%",borderRadius:99,transition:"width .6s"}}/>
            </div>
          </div>)}
        </Card>

        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <Sec>Water</Sec>
            <div style={{display:"flex",gap:7}}>
              <Btn sm outline color={C.ocean} onClick={()=>setWater(w=>Math.max(0,w-1))}>−</Btn>
              <Btn sm color={C.ocean} onClick={()=>setWater(w=>Math.min((goals.water||8)+4,w+1))}>+ Glass</Btn>
            </div>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {Array.from({length:goals.water||8}).map((_,i)=><div key={i} onClick={()=>setWater(i<water?i:i+1)} style={{fontSize:22,cursor:"pointer",opacity:i<water?1:.2,transform:i<water?"scale(1.1)":"scale(1)",transition:"all .2s",filter:i<water?`drop-shadow(0 0 5px ${C.ocean}88)`:"none"}}>💧</div>)}
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:8}}>{water*250}ml of {(goals.water||8)*250}ml</div>
        </Card>

        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <Sec>Today's Meals</Sec>
            <Btn sm color={C.coral} onClick={()=>setTab("log")}>+ Add</Btn>
          </div>
          {foodLog.length===0 && <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Nothing logged yet</div>}
          {foodLog.map(item=><div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            {item.image?<img src={item.image} alt="" style={{width:42,height:42,borderRadius:10,objectFit:"cover",flexShrink:0}}/>:<div style={{width:42,height:42,borderRadius:10,background:C.card2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🍽️</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}}>{item.name}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                <Pill color={C.coral} sm>{item.calories}kcal</Pill>
                <Pill color={C.ocean} sm>{item.protein}g P</Pill>
                {item.isProcessed && <Pill color={C.coral} sm>processed</Pill>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:2}}>{item.time}</div>
              <button onClick={()=>delFood(item.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>×</button>
            </div>
          </div>)}
        </Card>

        {/* Weight */}
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <Sec>Weight Trend</Sec>
            <Btn sm color={C.ocean} onClick={()=>setSW(true)}>+ Log</Btn>
          </div>
          {showWeight && <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={newWeight} onChange={e=>setNW(e.target.value)} type="number" placeholder="e.g. 84.2" step="0.1" style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",color:C.text,fontSize:14}}/>
            <Btn sm color={C.mint} onClick={addWeight}>Save</Btn>
            <Btn sm outline color={C.muted} onClick={()=>setSW(false)}>Cancel</Btn>
          </div>}
          <WeightChart entries={weights}/>
          {weights.length>0 && <button onClick={()=>setSCI(true)} style={{background:"none",border:`1px solid ${C.grape}44`,borderRadius:99,padding:"5px 14px",fontSize:11,color:C.grape,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:10}}>View weekly check-in →</button>}
        </Card>
      </>}

      {/* ── LOG ── */}
      {tab==="log" && <>
        <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Log Food</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Multiple ways to log — pick the fastest one.</div>

        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {["Breakfast","Lunch","Dinner","Snack","Post-workout"].map(m=><button key={m} onClick={()=>setMT(m)} style={{background:mealType===m?C.mint+"22":"transparent",color:mealType===m?C.mint:C.muted,border:`1px solid ${mealType===m?C.mint:C.border}`,borderRadius:99,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",flexShrink:0}}>{m}</button>)}
        </div>

        {/* Mode switcher */}
        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
          {[["photo","📸 Photo"],["voice","🎙️ Voice"],["nigerian","🍲 Nigerian DB"],["manual","✏️ Manual"]].map(([k,l])=><button key={k} onClick={()=>setLM(k)} style={{background:logMode===k?C.coral:"transparent",color:logMode===k?"#111":C.muted,border:`1px solid ${logMode===k?C.coral:C.border}`,borderRadius:99,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",flexShrink:0}}>{l}</button>)}
        </div>

        {/* Photo */}
        {logMode==="photo" && <Card>
          <Sec>AI Photo Analysis</Sec>
          {!uploadImg?<button onClick={()=>fileRef.current.click()} style={{width:"100%",background:C.card2,border:`2px dashed ${C.coral}55`,borderRadius:14,padding:"26px 0",color:C.coral,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Tap to upload food photo</button>:<div>
            <img src={uploadImg} alt="" style={{width:"100%",borderRadius:12,maxHeight:200,objectFit:"cover",marginBottom:10}}/>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <Btn full color={C.coral} disabled={analyzing} onClick={analyzePhoto}>{analyzing?"Analysing...":"Analyse with AI"}</Btn>
              <button onClick={()=>{setUI(null);setUD(null);setAR(null);}} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:99,padding:"0 14px",color:C.muted,cursor:"pointer",fontSize:18}}>×</button>
            </div>
          </div>}
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
          {analyzing && <div style={{textAlign:"center",padding:"12px 0",color:C.muted,fontSize:13}}><div style={{fontSize:20,animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</div><div style={{marginTop:4}}>Identifying food and nutrients...</div></div>}
          {aiErr && <div style={{color:C.coral,fontSize:12,padding:"8px 12px",background:C.coral+"11",borderRadius:8,marginTop:8}}>{aiErr}</div>}
          {aiResult && !voiceText && <AiCard result={aiResult} image={uploadImg} onAdd={addFood}/>}
        </Card>}

        {/* Voice */}
        {logMode==="voice" && <Card>
          <Sec>Voice Input</Sec>
          <Btn full color={voice.listening?C.coral:C.grape} onClick={voice.listening?voice.stop:voice.start}>{voice.listening?"🔴 Listening... (tap to stop)":"Tap & Speak"}</Btn>
          {voiceText && <div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:13,marginTop:8,border:`1px solid ${C.border}`}}><span style={{color:C.muted,fontSize:11,display:"block",marginBottom:2}}>You said:</span>"{voiceText}"</div>}
          {analyzing && voiceText && <div style={{textAlign:"center",padding:"10px 0",color:C.muted,fontSize:13}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</span> Estimating...</div>}
          {aiResult && voiceText && <AiCard result={aiResult} image={null} onAdd={addFood}/>}
          <div style={{fontSize:11,color:C.muted,marginTop:8}}>Try: "bowl of jollof rice with chicken" or "2 boiled eggs and toast"</div>
        </Card>}

        {/* Nigerian DB */}
        {logMode==="nigerian" && <Card>
          <Sec>🇳🇬 Nigerian Food Database</Sec>
          <input value={nigerSearch} onChange={e=>setNS(e.target.value)} placeholder="Search: jollof, egusi, suya..." style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",color:C.text,fontSize:14,marginBottom:12}}/>
          <div style={{maxHeight:400,overflowY:"auto"}}>
            {nigerFiltered.map(f=><button key={f.name} onClick={()=>addFood({name:f.name,calories:f.cal,protein:f.p,carbs:f.c,fat:f.f,fibre:f.fi,sodium:0,sugar:0,isProcessed:false,image:null})} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",color:C.text,textAlign:"left"}}>
              <div>
                <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{f.name}</div>
                <div style={{display:"flex",gap:5}}>
                  <Pill color={C.coral} sm>{f.cal}kcal</Pill>
                  <Pill color={C.ocean} sm>{f.p}g P</Pill>
                  <Pill color={C.sun} sm>{f.c}g C</Pill>
                  <Pill color={C.lime} sm>{f.f}g F</Pill>
                </div>
              </div>
              <span style={{color:C.mint,fontSize:20,flexShrink:0}}>+</span>
            </button>)}
          </div>
        </Card>}

        {/* Manual */}
        {logMode==="manual" && <Card>
          <Sec>Manual Entry</Sec>
          <Field label="Food name" value={manual.name} onChange={v=>setMan(p=>({...p,name:v}))} placeholder="e.g. Egusi soup + fufu"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["calories","Calories (kcal)","450"],["protein","Protein (g)","25"],["carbs","Carbs (g)","60"],["fat","Fat (g)","12"],["fibre","Fibre (g)","4"]].map(([k,l,ph])=><Field key={k} label={l} value={manual[k]} onChange={v=>setMan(p=>({...p,[k]:v}))} placeholder={ph} type="number"/>)}
          </div>
          <Btn full color={C.ocean} onClick={()=>{if(!manual.name||!manual.calories)return;addFood({name:manual.name,calories:+manual.calories||0,protein:+manual.protein||0,carbs:+manual.carbs||0,fat:+manual.fat||0,fibre:+manual.fibre||0,sodium:0,sugar:0,image:null,isProcessed:false});}}>Add to Log</Btn>
        </Card>}
      </>}

      {/* ── FAST ── */}
      {tab==="fast" && <>
        <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Fasting Timer</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Built for shift workers — flexible and smart.</div>

        {/* Shift Mode Toggle */}
        <Card glow={fast.shiftMode?C.orange:null}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>🌙 Night Shift Mode</div>
              <div style={{fontSize:12,color:C.muted}}>Fast during shift · Eat after you wake up</div>
            </div>
            <button onClick={()=>setFast(f=>({...f,shiftMode:!f.shiftMode}))} style={{width:48,height:26,borderRadius:99,background:fast.shiftMode?C.orange:C.border,border:"none",cursor:"pointer",position:"relative",transition:"background .3s",flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:fast.shiftMode?24:4,transition:"left .3s"}}/>
            </button>
          </div>
          {fast.shiftMode && <div style={{marginTop:12,background:C.orange+"11",borderRadius:10,padding:"10px 12px",fontSize:12,color:C.orange,border:`1px solid ${C.orange}33`}}>
            In shift mode: your fast runs <strong>during your shift</strong>. When you wake up, that's when you eat. Your eating window is {fast.eat}h after your fast ends.
          </div>}
        </Card>

        {!fast.active && <Card>
          <Sec>Protocol</Sec>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
            {[["16:8",16,8],["18:6",18,6],["20:4",20,4],["14:10",14,10]].map(([l,f,e])=><button key={l} onClick={()=>setFast(s=>({...s,window:f,eat:e}))} style={{background:fast.window===f?C.grape+"22":"transparent",color:fast.window===f?C.grape:C.muted,border:`1px solid ${fast.window===f?C.grape:C.border}`,borderRadius:99,padding:"6px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>)}
          </div>
          <div style={{display:"flex",gap:10}}>
            <Field label="Fast (hrs)" value={fast.window} onChange={v=>setFast(s=>({...s,window:+v}))} type="number" style={{flex:1}}/>
            <Field label="Eat (hrs)" value={fast.eat} onChange={v=>setFast(s=>({...s,eat:+v}))} type="number" style={{flex:1}}/>
          </div>
        </Card>}

        <Card glow={fast.active?C.grape:null} style={{textAlign:"center",padding:"28px 20px"}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:12}}>{fast.active?(fast.shiftMode?"Shift fast in progress":"Fasting in progress"):"Ready to start"}</div>
          <Ring value={fastEl} max={fast.window*3600} color={fast.shiftMode?C.orange:C.grape} size={170} stroke={10}>
            <div>
              <div style={{fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmtTimer(fastEl)}</div>
              <div style={{fontSize:11,color:C.muted}}>/ {fast.window}h goal</div>
              <div style={{fontSize:12,color:fast.shiftMode?C.orange:C.grape,marginTop:2}}>{Math.round(fastProg*100)}%</div>
            </div>
          </Ring>
          {fast.active && <div style={{marginTop:14,marginBottom:6}}>
            <div style={{fontSize:14,color:C.mint,fontWeight:600}}>🍽️ Eating window opens {fastEndTime}</div>
            <div style={{fontSize:12,color:C.muted}}>Closes {eatEndTime} · {fast.eat}h window</div>
          </div>}
          <div style={{marginTop:16}}>
            <Btn color={fast.active?C.coral:fast.shiftMode?C.orange:C.grape} onClick={()=>{
              if(fast.active){setFast(s=>({...s,active:false,start:null}));setFastEl(0);}
              else setFast(s=>({...s,active:true,start:Date.now()}));
            }}>{fast.active?"End Fast":fast.shiftMode?"Start Shift Fast":"Start Fast"}</Btn>
          </div>
        </Card>

        <Card>
          <Sec>Shift Worker Guide</Sec>
          {[
            ["🌙","Night shifts (e.g. 10pm–6am)","Start your fast at the beginning of your shift. Your body will use stored energy. Break your fast after you've slept."],
            ["☕","What you can have while fasting","Black coffee, plain tea, sparkling water, electrolytes — none of these break your fast."],
            ["🥗","Breaking your fast","Start with something light and protein-rich. Egusi with any protein, eggs, yoghurt. Don't go straight for a heavy carb meal."],
            ["💤","Sleep counts as fasting","8h sleep + a few waking hours = most of your fast done before you even try."],
          ].map(([icon,t,s])=><div key={t} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:20,flexShrink:0}}>{icon}</div>
            <div><div style={{fontWeight:600,fontSize:13}}>{t}</div><div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.5}}>{s}</div></div>
          </div>)}
        </Card>
      </>}

      {/* ── COACH ── */}
      {tab==="coach" && <>
        <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>AI Coach ✦</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Uses your profile, schedule, and mood data.</div>

        <Card glow={C.mint} style={{textAlign:"center",padding:"20px 16px"}}>
          {coachLoad?<div><div style={{fontSize:24,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:8}}>✦</div><div style={{fontSize:13,color:C.muted}}>Analysing your patterns...</div></div>:coachMsg?<div>
            <div style={{fontSize:22,marginBottom:8}}>🌱</div>
            <div style={{fontSize:14,color:C.text,lineHeight:1.8,fontStyle:"italic",marginBottom:16}}>"{coachMsg}"</div>
            <Btn sm outline color={C.mint} onClick={getCoach}>Get another insight</Btn>
          </div>:<div>
            <div style={{fontSize:36,marginBottom:10}}>✦</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:8}}>Personalised for: <span style={{color:C.text,fontWeight:600}}>{profile?.name}</span> · <span style={{color:C.mint}}>{profile?.schedule} schedule</span></div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Uses your food log, mood check-ins, fasting data, and triggers to give specific guidance.</div>
            <Btn color={C.mint} onClick={getCoach}>Get my insight</Btn>
          </div>}
        </Card>

        {/* Profile-aware nudges */}
        <Sec>Based on your profile</Sec>
        {[
          profile?.schedule==="shifts" && {icon:"🌙",text:`As a shift worker, your eating window should align with your waking hours — not the clock. Don't force breakfast at 8am if you slept at 7am.`},
          profile?.triggers?.includes("Late nights") && {icon:"🌃",text:"Late nights are a trigger for you. Plan a specific snack for those windows — a handful of nuts or dark chocolate — so you're not deciding when cravings hit."},
          {icon:"🇳🇬",text:"Nigerian staples like egusi and pepper soup are protein-rich and nutrient-dense. Don't avoid them — log them using the Nigerian food database in the Log tab."},
          {icon:"💧",text:`You've had ${water} glasses today. ${water<(goals.water||8)/2?"You're behind on water — try one glass before your next meal.":"Good progress on hydration."}`},
        ].filter(Boolean).map((m,i)=><Card key={i}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{fontSize:22,flexShrink:0}}>{m.icon}</div>
            <div style={{fontSize:13,lineHeight:1.6}}>{m.text}</div>
          </div>
        </Card>)}

        {moodLog.length>0 && <Card>
          <Sec>Mood After Meals</Sec>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {moodLog.slice(-10).map((m,i)=><div key={i} style={{background:C.card2,borderRadius:10,padding:"8px 10px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:18}}>{MOODS[m.moodAfter]}</div>
              <div style={{fontSize:9,color:C.muted,marginTop:1}}>{m.time}</div>
            </div>)}
          </div>
          <div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:12,color:C.muted,border:`1px solid ${C.mint}33`}}>
            Avg mood after eating: <span style={{color:C.mint,fontWeight:700}}>{MOODS[Math.round(moodLog.slice(-5).reduce((a,m)=>a+m.moodAfter,0)/Math.min(moodLog.length,5))]}</span>
          </div>
        </Card>}

        <Card>
          <Sec>Environment Tweaks</Sec>
          {["Put fruit somewhere visible — counter, not hidden in the fridge.","Move snacks out of eyeline. Out of sight genuinely means out of mind.","Keep a water bottle visible at work and at home.","Prep one thing tonight for tomorrow's first meal."].map((t,i)=><div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{color:C.lime,flexShrink:0}}>→</div>
            <div style={{fontSize:13,lineHeight:1.5}}>{t}</div>
          </div>)}
        </Card>
      </>}

      {/* ── INSIGHT ── */}
      {tab==="insight" && <>
        <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Insights ◈</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Your data, turned into understanding.</div>

        <Card>
          <Sec>Today at a Glance</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{l:"Calories",v:`${totals.calories}`,u:"kcal",c:C.coral},{l:"Protein",v:`${totals.protein}`,u:"g",c:C.ocean},{l:"Carbs",v:`${totals.carbs}`,u:"g",c:C.sun},{l:"Fat",v:`${totals.fat}`,u:"g",c:C.lime},{l:"Fibre",v:`${totals.fibre}`,u:"g",c:C.grape},{l:"Water",v:`${water}`,u:"gl",c:C.mint}].map(({l,v,u,c})=><div key={l} style={{background:C.card2,borderRadius:12,padding:"12px 8px",textAlign:"center",border:`1px solid ${c}22`}}>
              <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:"'Syne',sans-serif"}}>{v}<span style={{fontSize:10,color:C.muted}}>{u}</span></div>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
            </div>)}
          </div>
        </Card>

        <Card glow={C.ocean}>
          <Sec>Weekly Reflection</Sec>
          <div style={{fontSize:13,lineHeight:1.7,marginBottom:10}}>
            {foodLog.length===0?"Start logging meals to see weekly patterns here.":`You've logged ${foodLog.length} meal${foodLog.length>1?"s":""} today. ${totals.protein>=100?"Protein intake looks solid.":"Protein could go higher."} ${water>=(goals.water||8)?"Hydration is on track ✓.":"Hydration could be improved."}`}
          </div>
          {moodLog.length>0 && <div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:12,color:C.muted,border:`1px solid ${C.border}`}}>
            {moodLog.slice(-3).every(m=>m.moodAfter>=3)?"Your mood after meals has been positive recently — that's a good sign.":"Some meals seem to leave you feeling low. Worth noting what you ate and when."}
          </div>}
          <button onClick={()=>setSCI(true)} style={{background:"none",border:`1px solid ${C.grape}33`,borderRadius:99,padding:"6px 16px",fontSize:11,color:C.grape,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:10}}>View weekly programme check-in →</button>
        </Card>

        <Card>
          <Sec>Weight Trend</Sec>
          <WeightChart entries={weights}/>
        </Card>

        <Card>
          <Sec>Progress Beyond Weight</Sec>
          {[{l:"Meals logged today",v:`${foodLog.length}`,icon:"📋",c:C.ocean},{l:"Mood check-ins",v:`${moodLog.length} total`,icon:"😊",c:C.grape},{l:"Water today",v:`${water}/${goals.water||8}`,icon:"💧",c:C.mint},{l:"Fasting status",v:fast.active?"Active ✓":"Not started",icon:"⏱️",c:fast.active?C.mint:C.muted},{l:"Processed food",v:`${procPct}% of meals`,icon:"🏷️",c:procPct>50?C.coral:C.lime}].map(({l,v,icon,c})=><div key={l} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:20}}>{icon}</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{l}</div><div style={{fontSize:11,color:c,fontFamily:"'DM Mono',monospace",marginTop:1}}>{v}</div></div>
          </div>)}
        </Card>

        <Card>
          <Sec>Your Profile</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[["Schedule",profile?.schedule||"—"],["Goal",profile?.goal||"—"],["Triggers",profile?.triggers?.slice(0,2).join(", ")||"None"],["Budget",profile?.budget||"—"],["Cal target",`${goals.calories} kcal`],["Water",`${goals.water||8} glasses`]].map(([k,v])=><div key={k} style={{background:C.card2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:2}}>{k.toUpperCase()}</div>
              <div style={{fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{v}</div>
            </div>)}
          </div>
          <Btn sm outline color={C.muted} onClick={()=>{sv("profile",null);setHP(false);setPro(null);}}>Reset profile</Btn>
        </Card>
      </>}

    </div>
  </div>;
}
