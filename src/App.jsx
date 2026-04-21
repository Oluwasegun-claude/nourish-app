import { useState, useEffect, useRef, useCallback } from "react";

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const save = (k, v) => { try { localStorage.setItem("nourish_"+k, JSON.stringify(v)); } catch {} };
const load = (k, d) => { try { const v=localStorage.getItem("nourish_"+k); return v?JSON.parse(v):d; } catch { return d; } };
const today = () => new Date().toISOString().slice(0,10);
const timeStr = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmt = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`; };
const pct = (v,m) => Math.min(Math.round((v/m)*100),100);

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  coral:"#FF6B6B", mint:"#4ECDC4", sun:"#FFE66D", ocean:"#4A90D9",
  grape:"#C77DFF", lime:"#A8E063", orange:"#FF9A3C", pink:"#FF6EB4",
  bg:"#0A0A0A", card:"#141414", card2:"#1C1C1C", border:"#252525",
  text:"#F2F2F2", muted:"#6A6A6A",
};

const MOODS = ["😫","😔","😐","🙂","😄"];
const HUNGER_LABELS = ["Not hungry","A little","Moderate","Hungry","Very hungry"];
const DEFAULT_GOALS = { calories:2000, protein:150, carbs:200, fat:65, fibre:30, water:8 };

const COACH_NUDGES = [
  { icon:"🌙", text:"You tend to snack most after late shifts. Want a planned option for tonight?" },
  { icon:"💧", text:"You're averaging only 5 glasses on work days. Try keeping a bottle visible at all times." },
  { icon:"🥣", text:"You've skipped breakfast recently. A 2-min option: Greek yoghurt + banana." },
  { icon:"🌿", text:"Your fibre has been low this week. Add one handful of veg to your next meal." },
  { icon:"⚡", text:"On days you eat before 10am, your energy tends to be significantly higher." },
];

const CRAVING_MAP = {
  hunger:  { title:"Real Hunger",  color:C.coral,  action:"Your body needs fuel — eat a proper meal. Don't delay.", options:["Eggs + toast (8 min)","Rice + any protein","Oat porridge + fruit"] },
  boredom: { title:"Boredom",      color:C.ocean,  action:"Try a 5-min distraction first — walk, drink water, or step outside.", options:["1 glass of water","5-min walk","Call someone"] },
  stress:  { title:"Stress",       color:C.grape,  action:"Stress eating is real. A small planned snack beats unplanned grazing.", options:["Handful of nuts","Fresh fruit","Herbal tea + dark choc"] },
  habit:   { title:"Force of Habit", color:C.sun,  action:"This is a pattern trigger. Notice it — then decide consciously.", options:["Wait 10 minutes","Drink water first","Small planned snack"] },
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
  @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  ::-webkit-scrollbar{display:none}
  button:active{transform:scale(0.96)}
  input,select,button{font-family:'DM Sans',sans-serif;outline:none}
`;

function Pill({ children, color, sm }) {
  return <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:99,padding:sm?"2px 7px":"3px 10px",fontSize:sm?10:12,fontWeight:700,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{children}</span>;
}

function MBar({ label, value, max, color, unit="g" }) {
  const p = pct(value,max);
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{label}</span>
        <span style={{fontSize:12,color:C.text,fontFamily:"'DM Mono',monospace"}}>{value}{unit} / {max}{unit}</span>
      </div>
      <div style={{background:C.border,borderRadius:99,height:8,overflow:"hidden"}}>
        <div style={{width:`${p}%`,background:p>=100?"#FF4444":color,height:"100%",borderRadius:99,transition:"width .6s ease"}}/>
      </div>
    </div>
  );
}

function Ring({ value, max, color, size=100, stroke=9, children }) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, p=Math.min(value/max,1);
  return (
    <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${p*circ} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray .8s ease"}}/>
      </svg>
      <div style={{position:"absolute",textAlign:"center"}}>{children}</div>
    </div>
  );
}

function Card({ children, style={}, glow }) {
  return <div style={{background:C.card,borderRadius:18,padding:16,border:`1px solid ${glow?glow+"55":C.border}`,boxShadow:glow?`0 0 28px ${glow}18`:"none",marginBottom:12,...style}}>{children}</div>;
}

function Sec({ children }) {
  return <div style={{fontSize:11,color:C.muted,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:10,marginTop:2}}>{children}</div>;
}

function Btn({ children, onClick, color=C.coral, outline, full, sm, disabled, style={} }) {
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",background:outline?"transparent":color,color:outline?color:"#111",border:`1.5px solid ${color}`,borderRadius:99,padding:sm?"7px 16px":"11px 24px",fontSize:sm?12:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",opacity:disabled?.5:1,transition:"all .2s",...style}}>{children}</button>;
}

function Field({ label, value, onChange, type="text", placeholder, style={} }) {
  return (
    <div style={{marginBottom:11,...style}}>
      {label && <div style={{fontSize:10,color:C.muted,marginBottom:4,fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>}
      <input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder}
        style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 14px",color:C.text,fontSize:14}}/>
    </div>
  );
}

// ─── AI RESULT CARD ───────────────────────────────────────────────────────────
function AiCard({ result, image, onAdd }) {
  return (
    <div style={{background:C.card2,borderRadius:14,padding:14,border:`1px solid ${C.mint}44`,marginTop:10,animation:"slideIn .3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:15,fontFamily:"'Syne',sans-serif"}}>{result.name}</div>
        <Pill color={result.confidence==="high"?C.mint:result.confidence==="medium"?C.sun:C.coral} sm>{result.confidence}</Pill>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        <Pill color={C.coral}>{result.calories} kcal</Pill>
        <Pill color={C.ocean}>{result.protein}g P</Pill>
        <Pill color={C.sun}>{result.carbs}g C</Pill>
        <Pill color={C.lime}>{result.fat}g F</Pill>
        <Pill color={C.grape}>{result.fibre}g fibre</Pill>
        {result.isProcessed && <Pill color={C.coral}>processed</Pill>}
      </div>
      {result.notes && <div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:10}}>{result.notes}</div>}
      <Btn full color={C.mint} onClick={()=>onAdd({...result,image})}>✓ Add to Log</Btn>
    </div>
  );
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ name:"",age:"",weight:"",goal:"lose",schedule:"shifts",sleepTime:"23:00",stressLevel:3,culturalFoods:"",budget:"medium",triggers:[],calorieGoal:2000,waterGoal:8 });
  const s = k => v => setP(prev=>({...prev,[k]:v}));

  const STEPS = [
    {
      title:"Welcome to Nourish 🌱",
      sub:"Unlike other apps, we won't just ask your weight. This takes 2 minutes.",
      body: <>
        <Field label="Your first name" value={p.name} onChange={s("name")} placeholder="e.g. Samuel"/>
        <div style={{display:"flex",gap:10}}><Field label="Age" value={p.age} onChange={s("age")} type="number" placeholder="28" style={{flex:1}}/><Field label="Weight (kg)" value={p.weight} onChange={s("weight")} type="number" placeholder="85" style={{flex:1}}/></div>
      </>
    },
    {
      title:"Your Work Life 💼",
      sub:"Diet isn't separate from your schedule. This matters.",
      body: <>
        <Sec>Work Schedule</Sec>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
          {[["shifts","Shift Work"],["nine5","9–5"],["freelance","Freelance"],["remote","Remote"]].map(([v,l])=>(
            <button key={v} onClick={()=>setP(prev=>({...prev,schedule:v}))} style={{background:p.schedule===v?C.mint+"22":"transparent",color:p.schedule===v?C.mint:C.muted,border:`1px solid ${p.schedule===v?C.mint:C.border}`,borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>
          ))}
        </div>
        <Field label="Usual sleep time" value={p.sleepTime} onChange={s("sleepTime")} type="time"/>
        <Sec>Average Stress Level</Sec>
        <div style={{display:"flex",gap:8,marginBottom:4}}>
          {[1,2,3,4,5].map(n=>(
            <button key={n} onClick={()=>setP(prev=>({...prev,stressLevel:n}))} style={{width:44,height:44,borderRadius:"50%",border:`1px solid ${p.stressLevel>=n?C.coral:C.border}`,background:p.stressLevel>=n?C.coral+"22":"transparent",color:p.stressLevel>=n?C.coral:C.muted,fontWeight:700,fontSize:15,cursor:"pointer"}}>{n}</button>
          ))}
        </div>
      </>
    },
    {
      title:"Your Food Culture 🍲",
      sub:"We build suggestions around what you actually eat.",
      body: <>
        <Field label="Cultural / everyday foods" value={p.culturalFoods} onChange={s("culturalFoods")} placeholder="Jollof rice, egusi, suya, puff puff..."/>
        <Sec>Weekly Food Budget</Sec>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["tight","< £30"],["medium","£30–60"],["flexible","£60+"]].map(([v,l])=>(
            <button key={v} onClick={()=>setP(prev=>({...prev,budget:v}))} style={{flex:1,background:p.budget===v?C.sun+"22":"transparent",color:p.budget===v?C.sun:C.muted,border:`1px solid ${p.budget===v?C.sun:C.border}`,borderRadius:12,padding:"9px 0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>
          ))}
        </div>
        <Sec>Emotional Triggers (tap all that apply)</Sec>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Stress","Boredom","Late nights","After work","Loneliness","Anxiety","Celebrations"].map(t=>(
            <button key={t} onClick={()=>setP(prev=>({...prev,triggers:prev.triggers.includes(t)?prev.triggers.filter(x=>x!==t):[...prev.triggers,t]}))} style={{background:p.triggers.includes(t)?C.grape+"22":"transparent",color:p.triggers.includes(t)?C.grape:C.muted,border:`1px solid ${p.triggers.includes(t)?C.grape:C.border}`,borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{t}</button>
          ))}
        </div>
      </>
    },
    {
      title:"Your Goals 🎯",
      sub:"We'll adapt these dynamically based on your sleep and stress.",
      body: <>
        <Sec>Primary Goal</Sec>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["lose","Lose weight"],["maintain","Maintain"],["gain","Build muscle"]].map(([v,l])=>(
            <button key={v} onClick={()=>setP(prev=>({...prev,goal:v}))} style={{flex:1,background:p.goal===v?C.coral+"22":"transparent",color:p.goal===v?C.coral:C.muted,border:`1px solid ${p.goal===v?C.coral:C.border}`,borderRadius:12,padding:"9px 0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>
          ))}
        </div>
        <Field label="Daily calorie goal (kcal)" value={p.calorieGoal} onChange={v=>setP(prev=>({...prev,calorieGoal:+v}))} type="number" placeholder="2000"/>
        <Field label="Daily water goal (glasses)" value={p.waterGoal} onChange={v=>setP(prev=>({...prev,waterGoal:+v}))} type="number" placeholder="8"/>
        <div style={{background:C.card2,borderRadius:12,padding:12,fontSize:12,color:C.muted,border:`1px solid ${C.border}`}}>
          Based on your goal, consider <span style={{color:C.coral,fontWeight:700}}>{p.goal==="lose"?Math.max(1400,p.calorieGoal-400):p.goal==="gain"?p.calorieGoal+300:p.calorieGoal} kcal</span> on rest days, adjusted for sleep quality and stress.
        </div>
      </>
    },
  ];

  const curr = STEPS[step];
  return (
    <div style={{minHeight:"100vh",background:C.bg,padding:24,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{fonts}</style>
      <div style={{flex:1,maxWidth:440,margin:"0 auto",width:"100%",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",gap:6,marginBottom:30,marginTop:8}}>
          {STEPS.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:99,background:i<=step?C.coral:C.border,transition:"background .3s"}}/>)}
        </div>
        <div style={{fontSize:24,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4,color:C.text}}>{curr.title}</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:22}}>{curr.sub}</div>
        <div style={{flex:1}}>{curr.body}</div>
        <div style={{display:"flex",gap:10,marginTop:24,paddingBottom:16}}>
          {step>0 && <Btn outline color={C.muted} onClick={()=>setStep(s=>s-1)}>Back</Btn>}
          <Btn full color={C.coral} onClick={()=>step<STEPS.length-1?setStep(s=>s+1):onDone(p)}>
            {step<STEPS.length-1?"Continue →":"Get Started 🚀"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── VOICE HOOK ───────────────────────────────────────────────────────────────
function useVoice(onResult) {
  const [listening, setListening] = useState(false);
  const ref = useRef(null);
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported on this browser. Try Chrome."); return; }
    const r = new SR(); r.lang="en-GB"; r.interimResults=false;
    r.onresult = e => { onResult(e.results[0][0].transcript); setListening(false); };
    r.onend = () => setListening(false);
    r.start(); ref.current=r; setListening(true);
  },[onResult]);
  const stop = useCallback(()=>{ ref.current?.stop(); setListening(false); },[]);
  return { listening, start, stop };
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [hasProfile, setHasProfile] = useState(()=>!!load("profile",null));
  const [profile, setProfile]       = useState(()=>load("profile",null));
  const [tab, setTab]               = useState("home");
  const [foodLog, setFoodLog]       = useState(()=>load("log_"+today(),[]));
  const [water, setWater]           = useState(()=>load("water_"+today(),0));
  const [fast, setFast]             = useState(()=>load("fast",{active:false,start:null,window:16,eat:8}));
  const [moodLog, setMoodLog]       = useState(()=>load("moods",[]));
  const [fastEl, setFastEl]         = useState(0);
  const [now, setNow]               = useState(new Date());

  // Overlays
  const [badDay, setBadDay]         = useState(false);
  const [crave, setCrave]           = useState(false);
  const [craveType, setCraveType]   = useState(null);
  const [postMeal, setPostMeal]     = useState(null); // {id,step}
  const [hungerBefore, setHB]       = useState(2);
  const [moodBefore, setMB]         = useState(2);
  const [moodAfter, setMA]          = useState(3);

  // Log form
  const [uploadImg, setUploadImg]   = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [aiResult, setAiResult]     = useState(null);
  const [aiErr, setAiErr]           = useState(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [voiceText, setVoiceText]   = useState("");
  const [manual, setManual]         = useState({name:"",calories:"",protein:"",carbs:"",fat:"",fibre:""});
  const [mealType, setMealType]     = useState("Lunch");

  // Coach
  const [coachMsg, setCoachMsg]     = useState("");
  const [coachLoad, setCoachLoad]   = useState(false);

  const fileRef = useRef();
  const goals = {...DEFAULT_GOALS, calories:profile?.calorieGoal||2000, water:profile?.waterGoal||8};

  // Persist
  useEffect(()=>save("log_"+today(),foodLog),[foodLog]);
  useEffect(()=>save("water_"+today(),water),[water]);
  useEffect(()=>save("fast",fast),[fast]);
  useEffect(()=>save("moods",moodLog),[moodLog]);

  // Clocks
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    if(!fast.active||!fast.start) return;
    const t=setInterval(()=>setFastEl(Math.floor((Date.now()-fast.start)/1000)),1000);
    return()=>clearInterval(t);
  },[fast.active,fast.start]);

  const totals = foodLog.reduce((a,f)=>({calories:a.calories+f.calories,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat,fibre:a.fibre+f.fibre}),{calories:0,protein:0,carbs:0,fat:0,fibre:0});
  const remaining = Math.max(goals.calories - totals.calories, 0);
  const over = totals.calories > goals.calories;
  const fastProg = fast.window>0?Math.min(fastEl/(fast.window*3600),1):0;
  const procPct = foodLog.length?Math.round((foodLog.filter(f=>f.isProcessed).length/foodLog.length)*100):0;
  const fastEndStr = fast.start ? new Date(fast.start+fast.window*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "--:--";
  const eatEndStr  = fast.start ? new Date(fast.start+(fast.window+fast.eat)*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "--:--";

  const addFood = food => {
    const item = {...food, id:Date.now(), time:timeStr(), meal:mealType};
    setFoodLog(p=>[...p,item]);
    setPostMeal({id:item.id, step:"before"});
    setUploadImg(null); setUploadData(null); setAiResult(null); setAiErr(null); setVoiceText("");
    setManual({name:"",calories:"",protein:"",carbs:"",fat:"",fibre:""});
  };

  const delFood = id => setFoodLog(p=>p.filter(f=>f.id!==id));

  const handleImg = e => {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{setUploadImg(ev.target.result);setUploadData({base64:ev.target.result.split(",")[1],mediaType:file.type});setAiResult(null);setAiErr(null);};
    r.readAsDataURL(file);
  };

  const callAI = async (messages) => {
    const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages})});
    const data = await res.json();
    const text = data.content?.find(b=>b.type==="text")?.text||"{}";
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  };

  const analyzePhoto = async () => {
    if(!uploadData) return;
    setAnalyzing(true); setAiErr(null);
    try {
      const result = await callAI([{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:uploadData.mediaType,data:uploadData.base64}},
        {type:"text",text:`Analyse this food image. Return ONLY raw JSON (no markdown): name, calories (number), protein (grams), carbs (grams), fat (grams), fibre (grams), sodium (mg), sugar (grams), confidence ("high"/"medium"/"low"), notes (one sentence), isProcessed (boolean — is this ultra-processed?). Be realistic with portion estimates.`}
      ]}]);
      setAiResult(result);
    } catch { setAiErr("Couldn't analyse. Try again or enter manually."); }
    finally { setAnalyzing(false); }
  };

  const analyzeVoice = async text => {
    setAnalyzing(true); setAiErr(null);
    try {
      const result = await callAI([{role:"user",content:`User described food: "${text}". Estimate nutrition. Return ONLY raw JSON: name, calories (number), protein (grams), carbs (grams), fat (grams), fibre (grams), confidence ("high"/"medium"/"low"), notes (one sentence), isProcessed (boolean).`}]);
      setAiResult(result);
    } catch { setAiErr("Couldn't parse. Enter manually."); }
    finally { setAnalyzing(false); }
  };

  const getCoach = async () => {
    setCoachLoad(true);
    const ctx = {calories:totals.calories,goal:goals.calories,water,waterGoal:goals.water,fastActive:fast.active,schedule:profile?.schedule,meals:foodLog.length,recentMoods:moodLog.slice(-5).map(m=>m.moodAfter),triggers:profile?.triggers};
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,messages:[{role:"user",content:`You are a gentle, psychologically-informed nutrition coach. User data: ${JSON.stringify(ctx)}. Give ONE short personalised insight or nudge (2–3 sentences). Warm, practical, non-preachy. Plain text only.`}]})});
      const data = await res.json();
      setCoachMsg(data.content?.find(b=>b.type==="text")?.text||"Keep logging — patterns emerge over time.");
    } catch { setCoachMsg("Keep logging — patterns emerge over time and that's where real insight lives."); }
    finally { setCoachLoad(false); }
  };

  const voice = useVoice(text=>{ setVoiceText(text); analyzeVoice(text); });

  const saveMood = () => {
    setMoodLog(p=>[...p,{date:today(),time:timeStr(),moodBefore,hungerBefore,moodAfter,foodId:postMeal?.id}]);
    setPostMeal(null);
  };

  if(!hasProfile) return <Onboarding onDone={p=>{save("profile",p);setProfile(p);setHasProfile(true);}}/>;

  // ── BAD DAY MODE ────────────────────────────────────────────────────────────
  if(badDay) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{fonts}</style>
      <div style={{fontSize:52,marginBottom:16}}>🌧️</div>
      <div style={{fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:6}}>Bad Day Mode</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:28,maxWidth:300}}>No goals. No guilt. Just getting through today — and that's enough.</div>
      {[["💧","Stay hydrated","Water before anything else."],["🍌","Eat something simple","A banana, toast, or yoghurt — anything real."],["🚶","Move a little","Even 5 minutes outside counts."],["😴","Rest if you can","Sleep resets almost everything."]].map(([icon,t,s])=>(
        <div key={t} style={{background:C.card,borderRadius:14,padding:"14px 18px",width:"100%",maxWidth:360,marginBottom:10,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
          <div style={{fontSize:26}}>{icon}</div>
          <div><div style={{fontWeight:700,fontSize:14}}>{t}</div><div style={{fontSize:12,color:C.muted}}>{s}</div></div>
        </div>
      ))}
      <div style={{fontSize:12,color:C.muted,marginTop:14,maxWidth:280}}>Tomorrow is a fresh start. You haven't failed — you're human.</div>
      <Btn color={C.mint} style={{marginTop:22}} onClick={()=>setBadDay(false)}>Back to app</Btn>
    </div>
  );

  // ── CRAVING MODULE ──────────────────────────────────────────────────────────
  if(crave) {
    const resp = craveType ? CRAVING_MAP[craveType] : null;
    return (
      <div style={{minHeight:"100vh",background:C.bg,padding:24,fontFamily:"'DM Sans',sans-serif"}}>
        <style>{fonts}</style>
        <div style={{maxWidth:440,margin:"0 auto"}}>
          <button onClick={()=>{setCrave(false);setCraveType(null);}} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",marginBottom:20,fontFamily:"'DM Mono',monospace"}}>← Back</button>
          {!craveType ? (
            <>
              <div style={{fontSize:23,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4}}>I feel like snacking 🤔</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:22}}>Let's figure out what's actually going on.</div>
              {[["hunger","🍽️","I'm actually hungry","Stomach empty, low energy"],["boredom","😑","I'm bored / procrastinating","Nothing to do, restless"],["stress","😤","I'm stressed or anxious","After a hard shift or difficult moment"],["habit","🔄","It's just a habit","I always snack at this time"]].map(([k,icon,l,s])=>(
                <button key={k} onClick={()=>setCraveType(k)} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:10,display:"flex",alignItems:"center",gap:14,cursor:"pointer",color:C.text,textAlign:"left"}}>
                  <div style={{fontSize:28}}>{icon}</div>
                  <div><div style={{fontWeight:700,fontSize:14}}>{l}</div><div style={{fontSize:12,color:C.muted}}>{s}</div></div>
                </button>
              ))}
            </>
          ) : (
            <>
              <div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4,color:resp.color}}>{resp.title}</div>
              <Card glow={resp.color}><div style={{fontSize:14,lineHeight:1.6}}>{resp.action}</div></Card>
              <Sec>Options</Sec>
              {resp.options.map(o=><div key={o} style={{background:C.card2,borderRadius:12,padding:"12px 16px",marginBottom:8,border:`1px solid ${C.border}`,fontSize:14}}>{o}</div>)}
              <button onClick={()=>setCraveType(null)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",marginTop:6,fontFamily:"'DM Mono',monospace"}}>← Try a different answer</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── POST-MEAL CHECK-IN ──────────────────────────────────────────────────────
  if(postMeal) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{fonts}</style>
      <div style={{maxWidth:400,width:"100%"}}>
        {postMeal.step==="before" ? (
          <>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Before you eat 🍽️</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>15-second check-in. Builds real insight over time.</div>
            <Card>
              <Sec>How hungry are you?</Sec>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {HUNGER_LABELS.map((h,i)=><button key={i} onClick={()=>setHB(i)} style={{flex:1,minWidth:55,background:hungerBefore===i?C.ocean+"33":"transparent",color:hungerBefore===i?C.ocean:C.muted,border:`1px solid ${hungerBefore===i?C.ocean:C.border}`,borderRadius:10,padding:"8px 4px",fontSize:10,fontWeight:600,cursor:"pointer",textAlign:"center"}}>{h}</button>)}
              </div>
            </Card>
            <Card>
              <Sec>Current mood</Sec>
              <div style={{display:"flex",justifyContent:"space-around"}}>
                {MOODS.map((m,i)=><button key={i} onClick={()=>setMB(i)} style={{fontSize:28,background:"none",border:`2px solid ${moodBefore===i?C.grape:C.border}`,borderRadius:"50%",width:50,height:50,cursor:"pointer",transform:moodBefore===i?"scale(1.2)":"scale(1)",transition:"transform .2s"}}>{m}</button>)}
              </div>
            </Card>
            <Btn full color={C.coral} onClick={()=>setPostMeal({...postMeal,step:"after"})}>Log & Eat →</Btn>
            <button onClick={()=>setPostMeal(null)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",display:"block",margin:"12px auto 0",fontFamily:"'DM Mono',monospace"}}>Skip check-in</button>
          </>
        ) : (
          <>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4}}>After eating 😌</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>How do you feel now?</div>
            <Card>
              <Sec>Mood after eating</Sec>
              <div style={{display:"flex",justifyContent:"space-around"}}>
                {MOODS.map((m,i)=><button key={i} onClick={()=>setMA(i)} style={{fontSize:28,background:"none",border:`2px solid ${moodAfter===i?C.mint:C.border}`,borderRadius:"50%",width:50,height:50,cursor:"pointer",transform:moodAfter===i?"scale(1.2)":"scale(1)",transition:"transform .2s"}}>{m}</button>)}
              </div>
            </Card>
            <Btn full color={C.mint} onClick={saveMood}>Save Check-in ✓</Btn>
          </>
        )}
      </div>
    </div>
  );

  // ── TABS ────────────────────────────────────────────────────────────────────
  const TABS_DEF = [{id:"home",icon:"⬡",label:"Home"},{id:"log",icon:"＋",label:"Log"},{id:"fast",icon:"◎",label:"Fast"},{id:"coach",icon:"✦",label:"Coach"},{id:"insight",icon:"◈",label:"Insight"}];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:80}}>
      <style>{fonts}</style>

      {/* Header */}
      <div style={{padding:"18px 18px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.bg,zIndex:20}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",letterSpacing:-0.5}}><span style={{color:C.coral}}>N</span>ourish</div>
          <div style={{fontSize:11,color:C.muted}}>{now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short"})} · {profile?.name||"You"}</div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>{setCrave(true);setCraveType(null);}} style={{background:C.grape+"22",border:`1px solid ${C.grape}44`,borderRadius:99,padding:"5px 12px",fontSize:11,color:C.grape,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>craving?</button>
          <button onClick={()=>setBadDay(true)} style={{background:C.ocean+"22",border:`1px solid ${C.ocean}44`,borderRadius:99,padding:"5px 12px",fontSize:11,color:C.ocean,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>bad day</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
        {TABS_DEF.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.coral:"transparent"}`,color:tab===t.id?C.coral:C.muted,padding:"10px 4px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",display:"flex",flexDirection:"column",alignItems:"center",gap:1,transition:"color .2s"}}>
            <span style={{fontSize:15}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{padding:"14px 16px",animation:"slideIn .3s ease"}}>

        {/* HOME */}
        {tab==="home" && <>
          <Card glow={over?C.coral:C.sun} style={{display:"flex",alignItems:"center",gap:16}}>
            <Ring value={totals.calories} max={goals.calories} color={over?C.coral:C.sun} size={108} stroke={9}>
              <div><div style={{fontSize:17,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{totals.calories}</div><div style={{fontSize:9,color:C.muted}}>kcal</div></div>
            </Ring>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,fontFamily:"'Syne',sans-serif",marginBottom:3}}>{over?`${totals.calories-goals.calories} over goal`:`${remaining} remaining`}</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Goal: {goals.calories} kcal</div>
              <div style={{display:"flex",gap:12}}>
                {[{v:water,u:`/${goals.water}`,l:"glasses",c:C.ocean},{v:`${totals.fibre}g`,l:"fibre",c:C.grape},{v:fast.active?fmt(fastEl).slice(0,5):"--",l:"fasting",c:fast.active?C.mint:C.muted},{v:`${procPct}%`,l:"processed",c:procPct>50?C.coral:C.lime}].map(({v,u,l,c})=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontSize:14,fontWeight:700,color:c,fontFamily:"'Syne',sans-serif"}}>{v}<span style={{fontSize:9,color:C.muted}}>{u}</span></div>
                    <div style={{fontSize:9,color:C.muted}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <Sec>Macros</Sec>
            <MBar label="Protein" value={totals.protein} max={150} color={C.ocean}/>
            <MBar label="Carbs"   value={totals.carbs}   max={200} color={C.sun}/>
            <MBar label="Fat"     value={totals.fat}     max={65}  color={C.coral}/>
            <MBar label="Fibre"   value={totals.fibre}   max={30}  color={C.grape}/>
          </Card>

          <Card>
            <Sec>Health Signals</Sec>
            {[["Protein adequacy",pct(totals.protein,150),C.ocean],["Fibre adequacy",pct(totals.fibre,30),C.lime],["Hydration",pct(water,goals.water),C.mint],["Whole food ratio",100-procPct,C.sun],["Meal timing",foodLog.length>0?75:0,C.grape]].map(([l,v,c])=>(
              <div key={l} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,color:C.muted}}>{l}</span>
                  <span style={{fontSize:12,color:v>=80?c:v>=50?C.sun:C.coral,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v>=80?"✓ Good":v>=50?"OK":"Low"}</span>
                </div>
                <div style={{background:C.border,borderRadius:99,height:7,overflow:"hidden"}}>
                  <div style={{width:`${v}%`,background:v>=80?c:v>=50?C.sun:C.coral,height:"100%",borderRadius:99,transition:"width .6s"}}/>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <Sec>Water</Sec>
              <div style={{display:"flex",gap:7}}>
                <Btn sm outline color={C.ocean} onClick={()=>setWater(w=>Math.max(0,w-1))}>−</Btn>
                <Btn sm color={C.ocean} onClick={()=>setWater(w=>Math.min(goals.water+4,w+1))}>+ Glass</Btn>
              </div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {Array.from({length:goals.water}).map((_,i)=>(
                <div key={i} onClick={()=>setWater(i<water?i:i+1)} style={{fontSize:22,cursor:"pointer",opacity:i<water?1:.2,transform:i<water?"scale(1.1)":"scale(1)",transition:"all .2s",filter:i<water?`drop-shadow(0 0 5px ${C.ocean}88)`:"none"}}>💧</div>
              ))}
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:8}}>{water*250}ml of {goals.water*250}ml</div>
          </Card>

          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <Sec>Today's Meals</Sec>
              <Btn sm color={C.coral} onClick={()=>setTab("log")}>+ Add</Btn>
            </div>
            {foodLog.length===0 && <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Nothing logged yet</div>}
            {foodLog.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                {item.image?<img src={item.image} alt="" style={{width:42,height:42,borderRadius:10,objectFit:"cover",flexShrink:0}}/>:<div style={{width:42,height:42,borderRadius:10,background:C.card2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🍽️</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <Pill color={C.coral} sm>{item.calories}kcal</Pill>
                    <Pill color={C.ocean} sm>{item.protein}g P</Pill>
                    <Pill color={C.sun} sm>{item.carbs}g C</Pill>
                    {item.isProcessed && <Pill color={C.coral} sm>processed</Pill>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2}}>{item.time}</div>
                  <button onClick={()=>delFood(item.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>×</button>
                </div>
              </div>
            ))}
          </Card>
        </>}

        {/* LOG */}
        {tab==="log" && <>
          <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Log Food</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Photo, voice, or manual — your call.</div>

          <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
            {["Breakfast","Lunch","Dinner","Snack","Post-workout"].map(m=>(
              <button key={m} onClick={()=>setMealType(m)} style={{background:mealType===m?C.mint+"22":"transparent",color:mealType===m?C.mint:C.muted,border:`1px solid ${mealType===m?C.mint:C.border}`,borderRadius:99,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",flexShrink:0}}>{m}</button>
            ))}
          </div>

          <Card>
            <Sec>📸 Photo Analysis</Sec>
            {!uploadImg?<button onClick={()=>fileRef.current.click()} style={{width:"100%",background:C.card2,border:`2px dashed ${C.coral}55`,borderRadius:14,padding:"26px 0",color:C.coral,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Tap to upload a food photo</button>:(
              <div>
                <img src={uploadImg} alt="food" style={{width:"100%",borderRadius:12,maxHeight:200,objectFit:"cover",marginBottom:10}}/>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <Btn full color={C.coral} disabled={analyzing} onClick={analyzePhoto}>{analyzing?"Analysing...":"Analyse with AI"}</Btn>
                  <button onClick={()=>{setUploadImg(null);setUploadData(null);setAiResult(null);}} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:99,padding:"0 14px",color:C.muted,cursor:"pointer",fontSize:18}}>×</button>
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
            {analyzing && <div style={{textAlign:"center",padding:"12px 0",color:C.muted,fontSize:13}}><div style={{fontSize:20,animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</div><div style={{marginTop:4}}>Identifying food and estimating nutrients...</div></div>}
            {aiErr && <div style={{color:C.coral,fontSize:12,padding:"8px 12px",background:C.coral+"11",borderRadius:8,marginTop:8}}>{aiErr}</div>}
            {aiResult && <AiCard result={aiResult} image={uploadImg} onAdd={addFood}/>}
          </Card>

          <Card>
            <Sec>🎙️ Voice Input</Sec>
            <Btn full color={voice.listening?C.coral:C.grape} onClick={voice.listening?voice.stop:voice.start}>{voice.listening?"🔴 Listening... (tap to stop)":"Tap & Speak"}</Btn>
            {voiceText && <div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:13,marginTop:8,border:`1px solid ${C.border}`}}><span style={{color:C.muted,fontSize:11,display:"block",marginBottom:2}}>You said:</span>"{voiceText}"</div>}
            {analyzing && voiceText && <div style={{textAlign:"center",padding:"10px 0",color:C.muted,fontSize:13}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</span> Estimating nutrients...</div>}
            {aiResult && voiceText && !uploadImg && <AiCard result={aiResult} image={null} onAdd={addFood}/>}
            <div style={{fontSize:11,color:C.muted,marginTop:8}}>Try: "2 scrambled eggs and toast" or "bowl of jollof rice with chicken"</div>
          </Card>

          <Card>
            <Sec>✏️ Manual Entry</Sec>
            <Field label="Food name" value={manual.name} onChange={v=>setManual(p=>({...p,name:v}))} placeholder="e.g. Egusi soup + fufu"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["calories","Calories (kcal)","450"],["protein","Protein (g)","25"],["carbs","Carbs (g)","60"],["fat","Fat (g)","12"],["fibre","Fibre (g)","4"]].map(([k,l,ph])=>(
                <Field key={k} label={l} value={manual[k]} onChange={v=>setManual(p=>({...p,[k]:v}))} placeholder={ph} type="number"/>
              ))}
            </div>
            <Btn full color={C.ocean} onClick={()=>{
              if(!manual.name||!manual.calories) return;
              addFood({name:manual.name,calories:+manual.calories||0,protein:+manual.protein||0,carbs:+manual.carbs||0,fat:+manual.fat||0,fibre:+manual.fibre||0,sodium:0,sugar:0,image:null,isProcessed:false});
            }}>Add to Log</Btn>
          </Card>
        </>}

        {/* FAST */}
        {tab==="fast" && <>
          <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Fasting Timer</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Flexible windows — designed for shift workers.</div>

          {!fast.active && <Card>
            <Sec>Protocol</Sec>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
              {[["16:8",16,8],["18:6",18,6],["20:4",20,4],["14:10",14,10]].map(([l,f,e])=>(
                <button key={l} onClick={()=>setFast(s=>({...s,window:f,eat:e}))} style={{background:fast.window===f?C.grape+"22":"transparent",color:fast.window===f?C.grape:C.muted,border:`1px solid ${fast.window===f?C.grape:C.border}`,borderRadius:99,padding:"6px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{l}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <Field label="Fast window (hrs)" value={fast.window} onChange={v=>setFast(s=>({...s,window:+v}))} type="number" style={{flex:1}}/>
              <Field label="Eating window (hrs)" value={fast.eat} onChange={v=>setFast(s=>({...s,eat:+v}))} type="number" style={{flex:1}}/>
            </div>
          </Card>}

          <Card glow={fast.active?C.grape:null} style={{textAlign:"center",padding:"28px 20px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:12}}>{fast.active?"Fasting in progress":"Ready to start"}</div>
            <Ring value={fastEl} max={fast.window*3600} color={C.grape} size={170} stroke={10}>
              <div>
                <div style={{fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmt(fastEl)}</div>
                <div style={{fontSize:11,color:C.muted}}>/ {fast.window}h goal</div>
                <div style={{fontSize:12,color:C.grape,marginTop:2}}>{Math.round(fastProg*100)}%</div>
              </div>
            </Ring>
            {fast.active && <div style={{marginTop:14,marginBottom:6}}>
              <div style={{fontSize:14,color:C.mint,fontWeight:600}}>🍽️ Eating window opens {fastEndStr}</div>
              <div style={{fontSize:12,color:C.muted}}>Closes {eatEndStr} · {fast.eat}h window</div>
            </div>}
            <div style={{marginTop:16}}>
              <Btn color={fast.active?C.coral:C.grape} onClick={()=>{
                if(fast.active){setFast(s=>({...s,active:false,start:null}));setFastEl(0);}
                else setFast(s=>({...s,active:true,start:Date.now()}));
              }}>{fast.active?"End Fast":"Start Fast"}</Btn>
            </div>
          </Card>

          <Card>
            <Sec>Shift Worker Tips</Sec>
            {[["🌙","Night shifts","Start your fast when your shift begins. Break it when you wake up."],["☕","During fasting","Black coffee, plain tea, and water are all fine."],["🍳","Break your fast gently","Start light — eggs, fruit, or yoghurt before heavier meals."],["💤","Sleep counts","Sleeping counts as fasting. Align your window to your rest cycle."]].map(([icon,t,s])=>(
              <div key={t} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:20}}>{icon}</div>
                <div><div style={{fontWeight:600,fontSize:13}}>{t}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{s}</div></div>
              </div>
            ))}
          </Card>
        </>}

        {/* COACH */}
        {tab==="coach" && <>
          <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>AI Coach ✦</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Personalised nudges based on your patterns.</div>

          <Card glow={C.mint} style={{textAlign:"center",padding:"20px 16px"}}>
            {coachLoad?<div><div style={{fontSize:24,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:8}}>✦</div><div style={{fontSize:13,color:C.muted}}>Analysing your patterns...</div></div>:coachMsg?(
              <div>
                <div style={{fontSize:22,marginBottom:8}}>🌱</div>
                <div style={{fontSize:14,color:C.text,lineHeight:1.8,fontStyle:"italic",marginBottom:16}}>"{coachMsg}"</div>
                <Btn sm outline color={C.mint} onClick={getCoach}>Get another insight</Btn>
              </div>
            ):(
              <div>
                <div style={{fontSize:36,marginBottom:10}}>✦</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Get a personalised insight based on your food, mood, and fasting data today.</div>
                <Btn color={C.mint} onClick={getCoach}>Get my insight</Btn>
              </div>
            )}
          </Card>

          <Sec>Daily Nudges</Sec>
          {COACH_NUDGES.map((m,i)=>(
            <Card key={i}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{fontSize:22,flexShrink:0}}>{m.icon}</div>
                <div style={{fontSize:13,lineHeight:1.6}}>{m.text}</div>
              </div>
            </Card>
          ))}

          {moodLog.length>0 && <Card>
            <Sec>Mood After Meals</Sec>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {moodLog.slice(-10).map((m,i)=>(
                <div key={i} style={{background:C.card2,borderRadius:10,padding:"8px 10px",textAlign:"center",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:20}}>{MOODS[m.moodAfter]}</div>
                  <div style={{fontSize:9,color:C.muted,marginTop:2}}>{m.time}</div>
                </div>
              ))}
            </div>
          </Card>}

          <Card>
            <Sec>Environment Tweaks</Sec>
            {["Put fruit somewhere visible — on the counter, not hidden in the fridge.","Move snacks out of eyeline. Out of sight genuinely means out of mind.","Prep one simple thing tonight for tomorrow's breakfast.","Keep a water bottle on your desk or in your work bag."].map((tip,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{color:C.lime,fontSize:14,flexShrink:0}}>→</div>
                <div style={{fontSize:13,lineHeight:1.5}}>{tip}</div>
              </div>
            ))}
          </Card>
        </>}

        {/* INSIGHT */}
        {tab==="insight" && <>
          <div style={{fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif",marginBottom:4}}>Insights ◈</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Patterns from your data — updated as you log.</div>

          <Card>
            <Sec>Today at a Glance</Sec>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Calories",v:`${totals.calories}`,u:"kcal",c:C.coral},{l:"Protein",v:`${totals.protein}`,u:"g",c:C.ocean},{l:"Carbs",v:`${totals.carbs}`,u:"g",c:C.sun},{l:"Fat",v:`${totals.fat}`,u:"g",c:C.lime},{l:"Fibre",v:`${totals.fibre}`,u:"g",c:C.grape},{l:"Water",v:`${water}`,u:"gl",c:C.mint}].map(({l,v,u,c})=>(
                <div key={l} style={{background:C.card2,borderRadius:12,padding:"12px 8px",textAlign:"center",border:`1px solid ${c}22`}}>
                  <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:"'Syne',sans-serif"}}>{v}<span style={{fontSize:10,color:C.muted}}>{u}</span></div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card glow={C.ocean}>
            <Sec>Weekly Reflection</Sec>
            <div style={{fontSize:13,lineHeight:1.7,marginBottom:10}}>
              {foodLog.length===0?"Start logging meals to see weekly patterns here.":`You've logged ${foodLog.length} meal${foodLog.length>1?"s":""} today. ${totals.protein>=100?"Protein intake looks solid.":"Protein could go a bit higher."} ${water>=goals.water?"Hydration is on track ✓.":"Hydration could be improved."}`}
            </div>
            {moodLog.length>0 && <div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:12,color:C.muted,border:`1px solid ${C.border}`}}>
              <span style={{color:C.ocean,fontWeight:700}}>Mood pattern:</span> {moodLog.length} check-in{moodLog.length>1?"s":""} logged. {moodLog.slice(-3).every(m=>m.moodAfter>=3)?"Your mood after meals has been positive recently.":"Some meals seem to leave you feeling low — worth noting what you ate."}
            </div>}
          </Card>

          <Card>
            <Sec>Progress Beyond Weight</Sec>
            {[{l:"Consistency",v:foodLog.length>0?"1 day active ✓":"Start today",icon:"🔥",c:C.coral},{l:"Meals logged",v:`${foodLog.length} meals`,icon:"📋",c:C.ocean},{l:"Mood check-ins",v:`${moodLog.length} logged`,icon:"😊",c:C.grape},{l:"Fast status",v:fast.active?"In progress":"Not started",icon:"⏱️",c:C.mint},{l:"Hydration",v:`${water}/${goals.water} glasses`,icon:"💧",c:C.ocean}].map(({l,v,icon,c})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:20}}>{icon}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{l}</div><div style={{fontSize:11,color:c,fontFamily:"'DM Mono',monospace",marginTop:1}}>{v}</div></div>
              </div>
            ))}
          </Card>

          <Card>
            <Sec>Your Profile</Sec>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[["Schedule",profile?.schedule||"—"],["Goal",profile?.goal||"—"],["Triggers",profile?.triggers?.slice(0,2).join(", ")||"None"],["Budget",profile?.budget||"—"],["Cal target",`${profile?.calorieGoal||2000} kcal`],["Water target",`${profile?.waterGoal||8} glasses`]].map(([k,v])=>(
                <div key={k} style={{background:C.card2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:2}}>{k.toUpperCase()}</div>
                  <div style={{fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{v}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>{save("profile",null);setHasProfile(false);setProfile(null);}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:99,padding:"6px 16px",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Reset profile & onboarding</button>
          </Card>
        </>}

      </div>
    </div>
  );
}
