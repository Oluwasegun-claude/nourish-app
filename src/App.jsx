import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const sv = (k,v) => { try { localStorage.setItem("n4_"+k, JSON.stringify(v)); } catch {} };
const ld = (k,d) => { try { const v=localStorage.getItem("n4_"+k); return v?JSON.parse(v):d; } catch { return d; } };
// Cloud save/load helpers
const cloudSave = async (userId, key, value) => { try { await setDoc(doc(db, "users", userId, "data", key), { value, updatedAt: Date.now() }, { merge: true }); } catch(e) { console.log("Cloud save error:", e); } };
const cloudLoad = async (userId, key, fallback) => { try { const snap = await getDoc(doc(db, "users", userId, "data", key)); return snap.exists() ? snap.data().value : fallback; } catch { return fallback; } };

const migrate = () => {
  const keys = ["profile", "goals", "weights", "moods", "fast"];
  keys.forEach(k => {
    const old = localStorage.getItem("n_"+k);
    if (old && !localStorage.getItem("n4_"+k)) localStorage.setItem("n4_"+k, old);
  });
  for(let i=0; i<30; i++) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const s = d.toISOString().slice(0,10);
    ["log_", "water_", "steps_"].forEach(p => {
      const old = localStorage.getItem("n_"+p+s);
      if (old && !localStorage.getItem("n4_"+p+s)) localStorage.setItem("n4_"+p+s, old);
    });
  }
};
migrate();

const todayStr = () => new Date().toISOString().slice(0,10);
const timeStr  = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtT = s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const clamp = (v,mn,mx) => Math.max(mn,Math.min(mx,v));
const kgToLbs = kg => (kg*2.20462).toFixed(1);
const lbsToKg = lbs => (lbs/2.20462).toFixed(1);

// ─── TDEE CALCULATION (Mifflin-St Jeor) ──────────────────────────────────────
const calcTDEE = (profile) => {
  const { gender, weight, height, dob, activityLevel } = profile;
  const kg = profile.weightUnit==="lbs" ? +lbsToKg(weight) : +weight;
  const cm = +height;
  const age = dob ? Math.floor((Date.now()-new Date(dob))/(365.25*24*3600*1000)) : 30;
  let bmr = gender==="female"
    ? 10*kg + 6.25*cm - 5*age - 161
    : 10*kg + 6.25*cm - 5*age + 5;
  const multipliers = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
  const tdee = bmr * (multipliers[activityLevel]||1.55);
  const goalMod = { lose:-500, maintain:0, gain:300 };
  const targetCals = Math.round(tdee + (goalMod[profile.goal]||0));
  const protein = Math.round(kg * 2.0);
  const fat = Math.round(targetCals * 0.28 / 9);
  const carbs = Math.round((targetCals - protein*4 - fat*9) / 4);
  return { tdee: Math.round(tdee), targetCals, protein, fat, carbs, fibre:30 };
};

// ─── CUISINE DATABASES ────────────────────────────────────────────────────────
const CUISINES = {
  nigerian: {
    label:"🇳🇬 Nigerian", flag:"🇳🇬",
    foods:[
      {name:"Jollof Rice (1 cup)",cal:350,p:7,c:68,f:6,fi:2},
      {name:"Egusi Soup (1 serving)",cal:420,p:18,c:12,f:32,fi:4},
      {name:"Fufu (2 wraps)",cal:280,p:2,c:68,f:0,fi:3},
      {name:"Eba / Garri (medium)",cal:260,p:2,c:63,f:0,fi:2},
      {name:"Pounded Yam (medium)",cal:300,p:3,c:72,f:0,fi:4},
      {name:"Suya (100g)",cal:220,p:28,c:4,f:10,fi:0},
      {name:"Pepper Soup (1 bowl)",cal:180,p:22,c:5,f:7,fi:1},
      {name:"Moi Moi (1 wrap)",cal:190,p:12,c:22,f:6,fi:3},
      {name:"Akara (3 pieces)",cal:210,p:10,c:24,f:9,fi:4},
      {name:"Ogbono Soup",cal:390,p:16,c:10,f:30,fi:3},
      {name:"Efo Riro (1 serving)",cal:260,p:16,c:8,f:18,fi:5},
      {name:"Fried Plantain (6 slices)",cal:270,p:2,c:58,f:5,fi:3},
      {name:"Puff Puff (3 pieces)",cal:280,p:4,c:38,f:12,fi:1},
      {name:"Okra Soup",cal:200,p:12,c:14,f:12,fi:5},
      {name:"Asun (100g)",cal:230,p:26,c:3,f:12,fi:0},
      {name:"Rice & Stew (1 plate)",cal:480,p:18,c:72,f:14,fi:3},
      {name:"Catfish Pepper Soup",cal:200,p:28,c:4,f:8,fi:1},
      {name:"Goat Meat (100g grilled)",cal:190,p:27,c:0,f:9,fi:0},
    ]
  },
  ghanaian: {
    label:"🇬🇭 Ghanaian", flag:"🇬🇭",
    foods:[
      {name:"Waakye (1 plate)",cal:480,p:18,c:82,f:9,fi:6},
      {name:"Jollof Rice GH (1 cup)",cal:340,p:7,c:66,f:6,fi:2},
      {name:"Banku + Tilapia",cal:520,p:35,c:68,f:12,fi:3},
      {name:"Fufu + Light Soup",cal:400,p:14,c:74,f:8,fi:4},
      {name:"Kontomire Stew",cal:220,p:10,c:14,f:14,fi:5},
      {name:"Kelewele (fried plantain)",cal:290,p:2,c:60,f:7,fi:3},
      {name:"Tuo Zaafi",cal:280,p:5,c:64,f:2,fi:3},
      {name:"Groundnut Soup",cal:380,p:16,c:18,f:28,fi:4},
      {name:"Kenkey (1 ball)",cal:310,p:5,c:70,f:2,fi:3},
      {name:"Red Red (beans + plantain)",cal:430,p:14,c:68,f:12,fi:8},
    ]
  },
  jamaican: {
    label:"🇯🇲 Jamaican", flag:"🇯🇲",
    foods:[
      {name:"Jerk Chicken (100g)",cal:215,p:28,c:4,f:10,fi:0},
      {name:"Rice & Peas (1 cup)",cal:370,p:10,c:68,f:6,fi:5},
      {name:"Ackee & Saltfish",cal:320,p:22,c:12,f:20,fi:2},
      {name:"Curry Goat (1 serving)",cal:380,p:32,c:12,f:22,fi:2},
      {name:"Oxtail Stew",cal:420,p:34,c:14,f:24,fi:2},
      {name:"Callaloo (1 cup)",cal:90,p:6,c:8,f:3,fi:4},
      {name:"Festival (2 pieces)",cal:240,p:4,c:44,f:5,fi:1},
      {name:"Escovitch Fish",cal:290,p:30,c:8,f:14,fi:1},
      {name:"Plantain (boiled, 6 slices)",cal:200,p:2,c:52,f:0,fi:3},
      {name:"Mannish Water",cal:160,p:18,c:6,f:6,fi:1},
    ]
  },
  indian: {
    label:"🇮🇳 Indian", flag:"🇮🇳",
    foods:[
      {name:"Dal (1 bowl)",cal:230,p:13,c:36,f:4,fi:8},
      {name:"Chicken Curry (1 serving)",cal:350,p:28,c:12,f:20,fi:2},
      {name:"Biryani (1 plate)",cal:520,p:22,c:74,f:16,fi:3},
      {name:"Roti (2 pieces)",cal:180,p:6,c:34,f:3,fi:3},
      {name:"Palak Paneer",cal:280,p:14,c:10,f:20,fi:4},
      {name:"Samosa (2 pieces)",cal:320,p:7,c:38,f:16,fi:3},
      {name:"Chana Masala",cal:270,p:12,c:40,f:7,fi:10},
      {name:"Basmati Rice (1 cup)",cal:340,p:7,c:74,f:1,fi:1},
      {name:"Dosa (1 large)",cal:180,p:5,c:30,f:5,fi:2},
      {name:"Idli (3 pieces)",cal:150,p:5,c:28,f:1,fi:2},
    ]
  },
  pakistani: {
    label:"🇵🇰 Pakistani", flag:"🇵🇰",
    foods:[
      {name:"Nihari (1 serving)",cal:420,p:36,c:14,f:24,fi:2},
      {name:"Biryani PK (1 plate)",cal:540,p:24,c:76,f:16,fi:3},
      {name:"Haleem",cal:380,p:26,c:34,f:14,fi:5},
      {name:"Seekh Kebab (3 pieces)",cal:270,p:24,c:4,f:16,fi:0},
      {name:"Chapati (2 pieces)",cal:170,p:5,c:32,f:3,fi:3},
      {name:"Daal Makhani",cal:260,p:12,c:36,f:8,fi:7},
      {name:"Saag (1 serving)",cal:200,p:8,c:14,f:12,fi:5},
      {name:"Karahi Chicken",cal:380,p:32,c:10,f:22,fi:2},
      {name:"Paratha (1 piece)",cal:260,p:5,c:36,f:11,fi:2},
      {name:"Lassi (1 glass)",cal:150,p:6,c:22,f:4,fi:0},
    ]
  },
  british: {
    label:"🇬🇧 British", flag:"🇬🇧",
    foods:[
      {name:"Full English Breakfast",cal:750,p:40,c:44,f:40,fi:4},
      {name:"Fish & Chips (medium)",cal:680,p:30,c:72,f:30,fi:4},
      {name:"Shepherd's Pie (1 portion)",cal:480,p:26,c:46,f:20,fi:5},
      {name:"Sunday Roast (chicken)",cal:620,p:42,c:48,f:24,fi:6},
      {name:"Beans on Toast",cal:320,p:14,c:54,f:4,fi:9},
      {name:"Jacket Potato (medium)",cal:280,p:7,c:60,f:0,fi:5},
      {name:"Chicken Tikka Masala",cal:430,p:32,c:22,f:22,fi:3},
      {name:"Sausage Roll (1 large)",cal:340,p:10,c:28,f:20,fi:1},
      {name:"Porridge (medium bowl)",cal:220,p:7,c:36,f:5,fi:4},
      {name:"Cottage Pie (1 portion)",cal:460,p:28,c:44,f:18,fi:5},
    ]
  },
  mexican: {
    label:"🇲🇽 Mexican", flag:"🇲🇽",
    foods:[
      {name:"Chicken Burrito (large)",cal:680,p:38,c:72,f:22,fi:8},
      {name:"Tacos (3 corn tortilla)",cal:450,p:24,c:50,f:18,fi:5},
      {name:"Guacamole + chips",cal:380,p:5,c:34,f:24,fi:8},
      {name:"Enchiladas (2 pieces)",cal:500,p:26,c:54,f:20,fi:5},
      {name:"Tamales (2 pieces)",cal:420,p:14,c:56,f:16,fi:4},
      {name:"Pozole (1 bowl)",cal:320,p:22,c:38,f:8,fi:5},
      {name:"Black Bean Soup",cal:240,p:12,c:38,f:4,fi:10},
      {name:"Churros (3 pieces)",cal:350,p:5,c:48,f:16,fi:2},
      {name:"Quesadilla (1 large)",cal:480,p:24,c:46,f:22,fi:3},
      {name:"Ceviche (1 serving)",cal:180,p:22,c:10,f:4,fi:2},
    ]
  },
  chinese: {
    label:"🇨🇳 Chinese", flag:"🇨🇳",
    foods:[
      {name:"Fried Rice (1 cup)",cal:380,p:10,c:58,f:12,fi:2},
      {name:"Kung Pao Chicken",cal:380,p:30,c:18,f:20,fi:3},
      {name:"Dim Sum (4 pieces)",cal:280,p:14,c:30,f:12,fi:2},
      {name:"Beef Chow Mein",cal:480,p:28,c:56,f:16,fi:4},
      {name:"Sweet & Sour Pork",cal:450,p:24,c:48,f:18,fi:2},
      {name:"Wonton Soup (1 bowl)",cal:220,p:14,c:24,f:6,fi:1},
      {name:"Spring Roll (2 pieces)",cal:280,p:8,c:32,f:14,fi:2},
      {name:"Peking Duck (100g)",cal:340,p:26,c:4,f:24,fi:0},
      {name:"Mapo Tofu",cal:250,p:14,c:12,f:16,fi:3},
      {name:"Hot & Sour Soup",cal:140,p:8,c:16,f:4,fi:2},
    ]
  },
};

const NATIONALITY_TO_CUISINE = {
  "Nigerian":"nigerian","Ghanaian":"ghanaian","Jamaican":"jamaican",
  "Indian":"indian","Pakistani":"pakistani","British":"british",
  "English":"british","Scottish":"british","Welsh":"british",
  "Mexican":"mexican","Chinese":"chinese","American":"british",
  "Caribbean":"jamaican","West African":"nigerian","South Asian":"indian",
};

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  white:"#FFFFFF", accent:"#4A90D9", green:"#4ECDC4", red:"#FF6B6B",
  yellow:"#FFE66D", grape:"#C77DFF", lime:"#A8E063",
  bg:"#0A0A0A", card:"#141414", card2:"#1E1E1E",
  border:"#2A2A2A", text:"#F2F2F2", muted:"#5A5A5A", muted2:"#888",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500;600&display=swap');
  @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
  body{background:#0A0A0A;color:#F2F2F2;font-family:'DM Sans',sans-serif}
  ::-webkit-scrollbar{display:none}
  button{cursor:pointer;font-family:'DM Sans',sans-serif}
  button:active{transform:scale(0.97)}
  input{font-family:'DM Sans',sans-serif;outline:none}
`;

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const Big = ({children,style={}}) => <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:40,letterSpacing:-1,textTransform:"uppercase",lineHeight:1,...style}}>{children}</div>;
const Label = ({children,style={}}) => <div style={{fontSize:10,color:C.muted2,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:8,...style}}>{children}</div>;
const Card = ({children,style={},onClick,glow}) => <div onClick={onClick} style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${glow?glow+"55":C.border}`,marginBottom:10,boxShadow:glow?`0 0 20px ${glow}15`:"none",...style}}>{children}</div>;
const Divider = () => <div style={{height:1,background:C.border,margin:"12px 0"}}/>;

function PrimaryBtn({children,onClick,disabled,style={}}) {
  return <button onClick={onClick} disabled={disabled} style={{width:"100%",background:disabled?C.border:C.white,color:disabled?C.muted:"#000",border:"none",borderRadius:12,padding:"16px 0",fontSize:16,fontWeight:700,letterSpacing:0.3,...style}}>{children}</button>;
}
function SecBtn({children,onClick,color=C.accent,style={}}) {
  return <button onClick={onClick} style={{background:"transparent",color,border:`1.5px solid ${color}`,borderRadius:99,padding:"8px 18px",fontSize:13,fontWeight:700,fontFamily:"'DM Mono',monospace",...style}}>{children}</button>;
}
function Pill({children,color,sm}) {
  return <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:99,padding:sm?"2px 8px":"3px 10px",fontSize:sm?10:12,fontWeight:700,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{children}</span>;
}
function Ring({value,max,color,size=100,stroke=8,children}) {
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
  const p=Math.min(Math.round((value/max)*100),100);
  return <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:12,color:C.muted2}}>{label}</span>
      <span style={{fontSize:12,color:C.text,fontFamily:"'DM Mono',monospace"}}>{value}{unit} / {max}{unit}</span>
    </div>
    <div style={{background:C.border,borderRadius:99,height:7,overflow:"hidden"}}>
      <div style={{width:`${p}%`,background:p>=100?"#FF4444":color,height:"100%",borderRadius:99,transition:"width .6s"}}/>
    </div>
  </div>;
}

// ─── MACRO GRID (MacroFactor style) ──────────────────────────────────────────
function MacroGrid({goals,profile}) {
  const days=["M","T","W","T","F","S","S"];
  const isRestDay=(i)=>i===6; // Sunday rest
  const cal=(i)=>isRestDay(i)?Math.round(goals.targetCals*0.85):goals.targetCals;
  return <div>
    <div style={{display:"flex",gap:3}}>
      {days.map((d,i)=>{
        const c=cal(i);
        return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",gap:3}}>
          <div style={{background:"#1A3A5C",borderRadius:8,padding:"5px 2px",textAlign:"center",fontSize:10,fontWeight:700,color:C.accent,fontFamily:"'DM Mono',monospace"}}>{c}</div>
          <div style={{background:"#3A1A1A",borderRadius:8,padding:"5px 2px",textAlign:"center",fontSize:9,fontWeight:700,color:"#FFB3B3"}}>{goals.protein}P</div>
          <div style={{background:"#3A2E0A",borderRadius:8,padding:"5px 2px",textAlign:"center",fontSize:9,fontWeight:700,color:"#FFE0A0"}}>{goals.fat}F</div>
          <div style={{background:"#0A3020",borderRadius:8,padding:"5px 2px",textAlign:"center",fontSize:9,fontWeight:700,color:"#B3EFD4"}}>{goals.carbs}C</div>
          <div style={{textAlign:"center",fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{d}</div>
        </div>;
      })}
    </div>
  </div>;
}

// ─── DATE SELECT PICKER ───────────────────────────────────────────────────────
function SelectPicker({items,value,onChange,label}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 12px",color:C.white,fontSize:16,fontWeight:600,fontFamily:"'DM Sans',sans-serif",appearance:"none",WebkitAppearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 12px center"}}>
    {items.map(item=><option key={item} value={item} style={{background:"#1a1a1a",color:"#fff"}}>{item}</option>)}
  </select>;
}

// ─── STEPS TRACKER ───────────────────────────────────────────────────────────
function StepsCard({steps,goal=10000}) {
  const pct=Math.min(Math.round((steps/goal)*100),100);
  return <Card>
    <Label>Steps Today</Label>
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <Ring value={steps} max={goal} color={C.green} size={80} stroke={7}>
        <div style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:"'DM Mono',monospace"}}>{pct}%</div>
      </Ring>
      <div>
        <div style={{fontSize:28,fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:-1}}>{steps.toLocaleString()}</div>
        <div style={{fontSize:12,color:C.muted2}}>of {goal.toLocaleString()} goal</div>
        <div style={{fontSize:11,color:C.muted2,marginTop:4}}>≈ {Math.round(steps*0.04)} kcal burned · {(steps*0.762/1000).toFixed(1)} km</div>
      </div>
    </div>
  </Card>;
}

// ─── WEIGHT CHART ─────────────────────────────────────────────────────────────
function WeightChart({entries,unit}) {
  if(entries.length<2) return <div style={{color:C.muted2,fontSize:13,textAlign:"center",padding:"16px 0"}}>Log at least 2 weight entries to see your trend</div>;
  const vals=entries.map(e=>e.weight);
  const minV=Math.min(...vals)-0.5, maxV=Math.max(...vals)+0.5;
  const w=310,h=120,pad=28;
  const x=(i)=>pad+(i/(entries.length-1))*(w-pad*2);
  const y=(v)=>h-pad-((v-minV)/(maxV-minV))*(h-pad*2);
  const n=entries.length,mx=n>1?(n-1)/2:0,my=vals.reduce((a,v)=>a+v,0)/n;
  const slope=n>1?entries.reduce((a,_,i)=>a+(i-mx)*(vals[i]-my),0)/entries.reduce((a,_,i)=>a+(i-mx)**2,1):0;
  const intercept=my-slope*mx;
  const latest=vals[vals.length-1],change=+(latest-vals[0]).toFixed(1);
  const dispWeight=(v)=>unit==="lbs"?kgToLbs(v):v;
  return <div>
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{overflow:"visible"}}>
      <polyline points={entries.map((_,i)=>`${x(i)},${y(vals[i])}`).join(" ")} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1={x(0)} y1={y(intercept)} x2={x(n-1)} y2={y(intercept+slope*(n-1))} stroke={C.red} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.7"/>
      {entries.map((_,i)=><circle key={i} cx={x(i)} cy={y(vals[i])} r="3.5" fill={C.accent}/>)}
      {[minV+0.3,my,maxV-0.3].map((v,i)=><text key={i} x={pad-3} y={y(v)+4} fontSize="8" fill={C.muted2} textAnchor="end">{dispWeight(v)}</text>)}
    </svg>
    <div style={{display:"flex",gap:8,marginTop:8}}>
      {[{l:"Current",v:`${dispWeight(latest)} ${unit}`,c:C.accent},{l:"Change",v:`${change>0?"+":""}${dispWeight(Math.abs(change))} ${unit}`,c:change<=0?C.green:C.red},{l:"Trend",v:slope<-0.05?"↓ Losing":slope>0.05?"↑ Gaining":"→ Stable",c:slope<-0.05?C.green:slope>0.05?C.red:C.yellow}].map(({l,v,c})=><div key={l} style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${c}22`}}>
        <div style={{fontSize:9,color:C.muted2,marginBottom:2,fontFamily:"'DM Mono',monospace"}}>{l.toUpperCase()}</div>
        <div style={{fontSize:12,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div>
      </div>)}
    </div>
  </div>;
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS=Array.from({length:31},(_,i)=>String(i+1));
const YEARS=Array.from({length:80},(_,i)=>String(2006-i));

function Onboarding({onDone}) {
  const [screen,setScreen]=useState("welcome"); // welcome|privacy|steps|sex|dob|basics|body|lifestyle|goals|result
  const [p,setP]=useState({
    name:"",gender:"male",dobMonth:"Jan",dobDay:"1",dobYear:"1990",
    weight:"",weightUnit:"kg",height:"",heightUnit:"cm",
    nationality:"",activityLevel:"moderate",goal:"lose",
    schedule:"shifts",sleepTime:"23:00",stressLevel:3,
    culturalFoods:"",budget:"medium",triggers:[],
    calorieGoal:2000,waterGoal:8,
  });
  const [aiCalc,setAiCalc]=useState(null);
  const [calcLoading,setCalcLoading]=useState(false);
  const set=k=>v=>setP(prev=>({...prev,[k]:v}));

  const computeLocally=()=>{
    const dob=`${p.dobYear}-${String(MONTHS.indexOf(p.dobMonth)+1).padStart(2,"0")}-${String(p.dobDay).padStart(2,"0")}`;
    const full={...p,dob};
    const r=calcTDEE(full);
    setAiCalc(r);
    setP(prev=>({...prev,dob,calorieGoal:r.targetCals,waterGoal:8}));
  };

  const getAICalc=async()=>{
    setCalcLoading(true);
    const dob=`${p.dobYear}-${String(MONTHS.indexOf(p.dobMonth)+1).padStart(2,"0")}-${String(p.dobDay).padStart(2,"0")}`;
    const age=Math.floor((Date.now()-new Date(dob))/(365.25*24*3600*1000));
    try {
      const res=await fetch("/api/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        max_tokens:500,
        messages:[{role:"user",content:`Calculate personalised nutrition targets for: Age ${age}, Gender: ${p.gender}, Weight: ${p.weight}${p.weightUnit}, Height: ${p.height}${p.heightUnit}, Activity: ${p.activityLevel}, Goal: ${p.goal}, Nationality: ${p.nationality}. Use Mifflin-St Jeor formula. Return ONLY raw JSON: tdee (number), targetCals (number), protein (grams), fat (grams), carbs (grams), fibre (grams), reasoning (one sentence).`}]
      })});
      if(res.ok){
        const data=await res.json();
        const text=data.content?.find(b=>b.type==="text")?.text||"{}";
        const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
        setAiCalc(parsed);
        setP(prev=>({...prev,dob,calorieGoal:parsed.targetCals}));
      } else { computeLocally(); }
    } catch { computeLocally(); }
    setCalcLoading(false);
  };

  const finish=()=>{
    const cuisine=NATIONALITY_TO_CUISINE[p.nationality]||"nigerian";
    onDone({...p,cuisineKey:cuisine,calorieGoal:aiCalc?.targetCals||p.calorieGoal,macros:aiCalc});
  };

  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
    <style>{CSS}</style>

    {screen==="welcome" && <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:24}}>
      <Big style={{fontSize:52,marginBottom:8}}>Driven by<br/>science.<br/><span style={{color:C.accent}}>Built for<br/>your life.</span></Big>
      <div style={{fontSize:15,color:C.muted2,marginBottom:40,marginTop:8,lineHeight:1.6}}>AI nutrition tracking built around who you actually are — your culture, your shifts, your goals.</div>
      <PrimaryBtn onClick={()=>setScreen("privacy")}>Get Started</PrimaryBtn>
      <div style={{textAlign:"center",marginTop:12,fontSize:12,color:C.muted2}}>Already set up? <span style={{color:C.accent,cursor:"pointer"}} onClick={()=>setScreen("restore")}>Restore data →</span></div>
    </div>}

    {screen==="restore" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <Big style={{fontSize:42,marginBottom:12}}>Restore<br/>your<br/><span style={{color:C.accent}}>data.</span></Big>
      <div style={{fontSize:14,color:C.muted2,marginBottom:32,lineHeight:1.7}}>Paste your backup code or sign in with Google later to restore your logs.</div>
      <textarea 
        placeholder="Paste your sync code here..." 
        style={{width:"100%",height:200,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:16,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",resize:"none"}}
        onInput={e=>{
          try {
            const data = JSON.parse(atob(e.target.value));
            Object.keys(data).forEach(k => localStorage.setItem(k, JSON.stringify(data[k])));
            window.location.reload();
          } catch {}
        }}
      />
      <div style={{flex:1}}/>
      <SecBtn onClick={()=>setScreen("welcome")}>← Back</SecBtn>
    </div>}

    {screen==="privacy" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <Big style={{fontSize:42,marginBottom:12}}>Protecting<br/>your<br/><span style={{color:C.green}}>privacy.</span></Big>
      <div style={{fontSize:14,color:C.muted2,marginBottom:32,lineHeight:1.7}}>Your data stays on your device. We never sell it or use ad networks to track you.</div>
      {[["🔒","Your food log is local","Nothing leaves your device unless you choose to export it"],["🚫","No ads, ever","Nourish is ad-free and always will be"],["🧠","AI runs on demand","AI analysis only happens when you tap the button"]].map(([icon,t,s])=><Card key={t}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{fontSize:22}}>{icon}</div>
          <div><div style={{fontWeight:700,marginBottom:2}}>{t}</div><div style={{fontSize:12,color:C.muted2,lineHeight:1.5}}>{s}</div></div>
        </div>
      </Card>)}
      <div style={{flex:1}}/>
      <div style={{fontSize:11,color:C.muted,marginBottom:12,textAlign:"center"}}>By continuing you accept our Terms of Service and Privacy Policy</div>
      <PrimaryBtn onClick={()=>setScreen("steps")}>Accept and Continue</PrimaryBtn>
    </div>}

    {screen==="steps" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <Big style={{fontSize:40,marginBottom:4}}>Let's get<br/>started</Big>
      <div style={{fontSize:13,color:C.muted2,marginBottom:32}}>Your personalised programme awaits</div>
      {[["1","Basics","Your gender, age, weight and height — to calibrate your metabolism"],["2","Lifestyle","Work schedule, culture, and food triggers"],["3","Programme","Your AI-generated macro targets"]].map(([n,t,s])=><div key={n} style={{display:"flex",gap:16,marginBottom:20}}>
        <div style={{width:36,height:36,borderRadius:"50%",background:n==="1"?C.white:C.card2,color:n==="1"?"#000":C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,flexShrink:0,border:`1px solid ${C.border}`}}>{n}</div>
        <div style={{paddingTop:6}}><div style={{fontWeight:700,fontSize:15}}>{t}</div><div style={{fontSize:12,color:C.muted2,marginTop:2,lineHeight:1.5}}>{s}</div></div>
      </div>)}
      <div style={{flex:1}}/>
      <PrimaryBtn onClick={()=>setScreen("sex")}>Go to Basics</PrimaryBtn>
    </div>}

    {screen==="sex" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <div style={{height:4,background:C.border,borderRadius:99,marginBottom:28}}><div style={{width:"20%",height:"100%",background:C.white,borderRadius:99}}/></div>
      <Big style={{fontSize:36,marginBottom:28}}>What is<br/>your sex?</Big>
      {[["male","♂ Male"],["female","♀ Female"]].map(([v,l])=><button key={v} onClick={()=>{set("gender")(v);setScreen("dob");}} style={{background:p.gender===v?C.card2:C.card,border:`1.5px solid ${p.gender===v?C.white:C.border}`,borderRadius:12,padding:"18px 20px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",color:C.text,fontSize:16,fontWeight:600}}>
        {l}
        <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${p.gender===v?C.white:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {p.gender===v && <div style={{width:10,height:10,borderRadius:"50%",background:C.white}}/>}
        </div>
      </button>)}
    </div>}

    {screen==="dob" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <div style={{height:4,background:C.border,borderRadius:99,marginBottom:28}}><div style={{width:"35%",height:"100%",background:C.white,borderRadius:99}}/></div>
      <Big style={{fontSize:36,marginBottom:28}}>When were<br/>you born?</Big>
      <div style={{display:"flex",gap:12,flex:1}}>
        <div style={{flex:1.4}}><Label>Month</Label><SelectPicker items={MONTHS} value={p.dobMonth} onChange={set("dobMonth")}/></div>
        <div style={{flex:1}}><Label>Day</Label><SelectPicker items={DAYS} value={p.dobDay} onChange={set("dobDay")}/></div>
        <div style={{flex:1.4}}><Label>Year</Label><SelectPicker items={YEARS} value={p.dobYear} onChange={set("dobYear")}/></div>
      </div>
      <div style={{marginTop:16}}><PrimaryBtn onClick={()=>setScreen("basics")}>Next</PrimaryBtn></div>
    </div>}

    {screen==="basics" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <div style={{height:4,background:C.border,borderRadius:99,marginBottom:28}}><div style={{width:"50%",height:"100%",background:C.white,borderRadius:99}}/></div>
      <Big style={{fontSize:36,marginBottom:20}}>The basics</Big>
      <div style={{marginBottom:12}}>
        <Label>Your name</Label>
        <input value={p.name} onChange={e=>set("name")(e.target.value)} placeholder="First name" style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",color:C.text,fontSize:15}}/>
      </div>
      <div style={{marginBottom:12}}>
        <Label>Nationality</Label>
        <input value={p.nationality} onChange={e=>set("nationality")(e.target.value)} placeholder="e.g. Nigerian, British, Jamaican..." style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",color:C.text,fontSize:15}}/>
        <div style={{fontSize:11,color:C.muted2,marginTop:4}}>This loads your local cuisine database for accurate food logging</div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <div style={{flex:1}}>
          <Label>Height</Label>
          <input value={p.height} onChange={e=>set("height")(e.target.value)} type="number" placeholder={p.heightUnit==="cm"?"175":"5.9"} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",color:C.text,fontSize:15}}/>
        </div>
        <div style={{flex:0}}>
          <Label>&nbsp;</Label>
          <button onClick={()=>set("heightUnit")(p.heightUnit==="cm"?"ft":"cm")} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 12px",color:C.accent,fontSize:13,fontWeight:700,marginTop:0}}>{p.heightUnit}</button>
        </div>
      </div>
      <div style={{flex:1}}/>
      <PrimaryBtn onClick={()=>setScreen("body")} disabled={!p.name||!p.height}>Next</PrimaryBtn>
    </div>}

    {screen==="body" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <div style={{height:4,background:C.border,borderRadius:99,marginBottom:28}}><div style={{width:"65%",height:"100%",background:C.white,borderRadius:99}}/></div>
      <Big style={{fontSize:36,marginBottom:8}}>Your weight</Big>
      <div style={{fontSize:13,color:C.muted2,marginBottom:24}}>Used to calculate your accurate calorie target</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["kg","lbs"].map(u=><button key={u} onClick={()=>set("weightUnit")(u)} style={{flex:1,background:p.weightUnit===u?C.white:C.card2,color:p.weightUnit===u?"#000":C.muted2,border:`1px solid ${p.weightUnit===u?C.white:C.border}`,borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700}}>{u}</button>)}
      </div>
      <div style={{marginBottom:24}}>
        <input value={p.weight} onChange={e=>set("weight")(e.target.value)} type="number" step="0.1" placeholder={p.weightUnit==="kg"?"85":"187"} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 16px",color:C.text,fontSize:28,fontWeight:700,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif"}}/>
        <div style={{textAlign:"center",fontSize:13,color:C.muted2,marginTop:8}}>{p.weightUnit}</div>
      </div>
      {p.weight && p.weightUnit==="lbs" && <div style={{background:C.card2,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.muted2,textAlign:"center",marginBottom:16}}>= {lbsToKg(p.weight)} kg</div>}
      <div style={{flex:1}}/>
      <PrimaryBtn onClick={()=>setScreen("lifestyle")} disabled={!p.weight}>Next</PrimaryBtn>
    </div>}

    {screen==="lifestyle" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24,overflowY:"auto"}}>
      <div style={{height:4,background:C.border,borderRadius:99,marginBottom:28}}><div style={{width:"80%",height:"100%",background:C.white,borderRadius:99}}/></div>
      <Big style={{fontSize:36,marginBottom:20}}>Your lifestyle</Big>

      <Label>Activity Level</Label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
        {[["sedentary","Sedentary"],["light","Light"],["moderate","Moderate"],["active","Active"],["very_active","Very Active"]].map(([v,l])=><button key={v} onClick={()=>set("activityLevel")(v)} style={{background:p.activityLevel===v?C.white:C.card2,color:p.activityLevel===v?"#000":C.muted2,border:`1px solid ${p.activityLevel===v?C.white:C.border}`,borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:700}}>{l}</button>)}
      </div>

      <Label>Work Schedule</Label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
        {[["shifts","Shift / Nights"],["nine5","9–5"],["freelance","Freelance"]].map(([v,l])=><button key={v} onClick={()=>set("schedule")(v)} style={{background:p.schedule===v?C.accent+"33":"transparent",color:p.schedule===v?C.accent:C.muted2,border:`1px solid ${p.schedule===v?C.accent:C.border}`,borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:700}}>{l}</button>)}
      </div>

      <Label>Emotional Eating Triggers</Label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
        {["Stress","Boredom","Late nights","After work","Anxiety","Celebrations"].map(t=><button key={t} onClick={()=>set("triggers")(p.triggers.includes(t)?p.triggers.filter(x=>x!==t):[...p.triggers,t])} style={{background:p.triggers.includes(t)?C.grape+"33":"transparent",color:p.triggers.includes(t)?C.grape:C.muted2,border:`1px solid ${p.triggers.includes(t)?C.grape:C.border}`,borderRadius:99,padding:"6px 12px",fontSize:11,fontWeight:600}}>{t}</button>)}
      </div>

      <div style={{flex:1}}/>
      <PrimaryBtn onClick={()=>setScreen("goals")}>Next</PrimaryBtn>
    </div>}

    {screen==="goals" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <div style={{height:4,background:C.border,borderRadius:99,marginBottom:28}}><div style={{width:"95%",height:"100%",background:C.white,borderRadius:99}}/></div>
      <Big style={{fontSize:36,marginBottom:8}}>Your goal</Big>
      <div style={{fontSize:13,color:C.muted2,marginBottom:24}}>This shapes your entire programme</div>
      {[["lose","Lose Weight","Calorie deficit · preserve muscle"],["maintain","Maintain Weight","Match your energy expenditure"],["gain","Build Muscle","Calorie surplus · high protein"]].map(([v,l,s])=><button key={v} onClick={()=>set("goal")(v)} style={{background:p.goal===v?C.card2:C.card,border:`1.5px solid ${p.goal===v?C.white:C.border}`,borderRadius:12,padding:"16px 20px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",color:C.text,textAlign:"left"}}>
        <div><div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{l}</div><div style={{fontSize:12,color:C.muted2}}>{s}</div></div>
        <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${p.goal===v?C.white:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {p.goal===v&&<div style={{width:10,height:10,borderRadius:"50%",background:C.white}}/>}
        </div>
      </button>)}
      <div style={{flex:1}}/>
      <PrimaryBtn onClick={()=>{setScreen("result");getAICalc();}}>Calculate My Programme</PrimaryBtn>
    </div>}

    {screen==="result" && <div style={{flex:1,display:"flex",flexDirection:"column",padding:24}}>
      <Big style={{fontSize:36,marginBottom:20}}>{calcLoading?"Calculating...":"Your macro\nprogramme\nis ready"}</Big>
      {calcLoading?<div style={{textAlign:"center",padding:"40px 0"}}>
        <div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</div>
        <div style={{fontSize:13,color:C.muted2,marginTop:12}}>AI is calculating your personalised targets using your age, weight, height, activity level and goal...</div>
      </div>:aiCalc&&<>
        <Card style={{marginBottom:16}}>
          <MacroGrid goals={{...aiCalc,targetCals:aiCalc.targetCals}} profile={p}/>
        </Card>
        <Label>How your programme was designed</Label>
        <Card>
          <div style={{display:"flex",gap:12,marginBottom:12}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>1</div>
            <div><div style={{fontWeight:700,fontSize:14}}>Estimated Expenditure</div><div style={{color:C.accent,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{aiCalc.tdee} kcal</div><div style={{fontSize:12,color:C.muted2,marginTop:2,lineHeight:1.5}}>{aiCalc.reasoning||"Based on your age, weight, height and activity level"}</div></div>
          </div>
          <Divider/>
          <div style={{display:"flex",gap:12}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#111",flexShrink:0}}>2</div>
            <div><div style={{fontWeight:700,fontSize:14}}>Average Daily Target</div><div style={{color:C.green,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{aiCalc.targetCals} kcal</div><div style={{fontSize:12,color:C.muted2,marginTop:2}}>{aiCalc.protein}g protein · {aiCalc.fat}g fat · {aiCalc.carbs}g carbs</div></div>
          </div>
        </Card>
        <div style={{flex:1}}/>
        <PrimaryBtn onClick={finish}>Done — Let's Go 🚀</PrimaryBtn>
      </>}
    </div>}
  </div>;
}

// ─── VOICE HOOK ───────────────────────────────────────────────────────────────
function useVoice(onResult) {
  const [listening,setL]=useState(false);
  const ref=useRef(null);
  const start=useCallback(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Voice input: use Chrome on Android or Safari on iPhone.");return;}
    const r=new SR();r.lang="en-GB";r.interimResults=false;
    r.onresult=e=>{onResult(e.results[0][0].transcript);setL(false);};
    r.onend=()=>setL(false);r.start();ref.current=r;setL(true);
  },[onResult]);
  const stop=useCallback(()=>{ref.current?.stop();setL(false);},[]);
  return {listening,start,stop};
}

// ─── AI CARD ──────────────────────────────────────────────────────────────────
function AiCard({result,image,onAdd}) {
  return <Card glow={C.green} style={{marginTop:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{fontWeight:700,fontSize:15}}>{result.name}</div>
      <Pill color={result.confidence==="high"?C.green:result.confidence==="medium"?C.yellow:C.red} sm>{result.confidence}</Pill>
    </div>
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
      <Pill color={C.red}>{result.calories}kcal</Pill>
      <Pill color={C.accent}>{result.protein}g P</Pill>
      <Pill color={C.yellow}>{result.carbs}g C</Pill>
      <Pill color={C.lime}>{result.fat}g F</Pill>
      <Pill color={C.grape}>{result.fibre}g fi</Pill>
      {result.isProcessed&&<Pill color={C.red}>processed</Pill>}
    </div>
    {result.notes&&<div style={{fontSize:12,color:C.muted2,fontStyle:"italic",marginBottom:10,lineHeight:1.5}}>{result.notes}</div>}
    <PrimaryBtn onClick={()=>onAdd({...result,image})} style={{padding:"12px 0",fontSize:14}}>Add to Log</PrimaryBtn>
  </Card>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const DEFAULT_GOALS={calories:2000,protein:150,carbs:200,fat:65,fibre:30,water:8};
const MOODS=["😫","😔","😐","🙂","😄"];
const HUNGER_L=["Not hungry","A little","Moderate","Hungry","Very hungry"];

export default function App() {
  // ── AUTH STATE ─────────────────────────────────────────────────────────
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [authScreen,setAuthScreen]=useState(false);
  const uid=user?.uid||null;

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,u=>{setUser(u);setAuthLoading(false);});
    return unsub;
  },[]);

  // Cloud sync helper — saves to both localStorage and Firestore
  const save=(key,value)=>{ sv(key,value); if(uid) cloudSave(uid,key,value); };

  const [hasProfile,setHP]=useState(()=>!!ld("profile",null));
  const [profile,setPro]=useState(()=>ld("profile",null));
  const [tab,setTab]=useState("home");
  const [foodLog,setFL]=useState(()=>ld("log_"+todayStr(),[]));
  const [water,setWater]=useState(()=>ld("water_"+todayStr(),0));
  const [fast,setFast]=useState(()=>ld("fast",{active:false,start:null,window:16,eat:8,shiftMode:false}));
  const [fastEl,setFE]=useState(0);
  const [moodLog,setML]=useState(()=>ld("moods",[]));
  const [weights,setWts]=useState(()=>ld("weights",[]));
  const [goals,setGoals]=useState(()=>ld("goals",{...DEFAULT_GOALS}));
  const [steps,setSteps]=useState(()=>ld("steps_"+todayStr(),0));
  const [now,setNow]=useState(new Date());

  // ── LOAD FROM CLOUD ON LOGIN ─────────────────────────────────────────
  const [cloudLoaded,setCloudLoaded]=useState(false);
  useEffect(()=>{
    if(!uid||cloudLoaded)return;
    (async()=>{
      const cp=await cloudLoad(uid,"profile",null);
      if(cp){setPro(cp);setHP(true);sv("profile",cp);}
      const cg=await cloudLoad(uid,"goals",null);
      if(cg){setGoals(cg);sv("goals",cg);}
      const cl=await cloudLoad(uid,"log_"+todayStr(),null);
      if(cl){setFL(cl);sv("log_"+todayStr(),cl);}
      const cw=await cloudLoad(uid,"water_"+todayStr(),null);
      if(cw!==null){setWater(cw);sv("water_"+todayStr(),cw);}
      const cf=await cloudLoad(uid,"fast",null);
      if(cf){setFast(cf);sv("fast",cf);}
      const cm=await cloudLoad(uid,"moods",null);
      if(cm){setML(cm);sv("moods",cm);}
      const cwt=await cloudLoad(uid,"weights",null);
      if(cwt){setWts(cwt);sv("weights",cwt);}
      const cs=await cloudLoad(uid,"steps_"+todayStr(),null);
      if(cs!==null){setSteps(cs);sv("steps_"+todayStr(),cs);}
      setCloudLoaded(true);
    })();
  },[uid,cloudLoaded]);

  // overlays
  const [badDay,setBD]=useState(false);
  const [crave,setCrave]=useState(false);
  const [craveType,setCT]=useState(null);
  const [postMeal,setPM]=useState(null);
  const [hungerB,setHB]=useState(2);
  const [moodB,setMB]=useState(2);
  const [moodA,setMA]=useState(3);
  const [showWt,setSW]=useState(false);
  const [newWt,setNW]=useState("");
  const [showCheckin,setSCI]=useState(false);
  const [editProfile,setEP]=useState(false);
  const [editData,setED]=useState(null);
  const [selectedCuisine,setSC]=useState(null);
  const [workoutCals,setWC]=useState("");
  const [showWorkout,setShowWorkout]=useState(false);
  const [manualSteps,setManualSteps]=useState("");
  const [showStepInput,setShowStepInput]=useState(false);

  // log form
  const [uploadImg,setUI]=useState(null);
  const [uploadData,setUD]=useState(null);
  const [aiResult,setAR]=useState(null);
  const [aiErr,setAE]=useState(null);
  const [analyzing,setANZ]=useState(false);
  const [voiceText,setVT]=useState("");
  const [logMode,setLM]=useState("photo");
  const [mealType,setMT]=useState("Lunch");
  const [manual,setMan]=useState({name:"",calories:"",protein:"",carbs:"",fat:"",fibre:""});
  const [nigerSearch,setNS]=useState("");
  const [coachMsg,setCM]=useState("");
  const [coachLoad,setCL]=useState(false);
  const fileRef=useRef();

  useEffect(()=>save("log_"+todayStr(),foodLog),[foodLog]);
  useEffect(()=>save("water_"+todayStr(),water),[water]);
  useEffect(()=>save("fast",fast),[fast]);
  useEffect(()=>save("moods",moodLog),[moodLog]);
  useEffect(()=>save("weights",weights),[weights]);
  useEffect(()=>save("goals",goals),[goals]);
  useEffect(()=>save("steps_"+todayStr(),steps),[steps]);
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    if(!fast.active||!fast.start)return;
    const t=setInterval(()=>setFE(Math.floor((Date.now()-fast.start)/1000)),1000);
    return()=>clearInterval(t);
  },[fast.active,fast.start]);

  // Try to get steps from device
  useEffect(()=>{
    if("Accelerometer" in window) {
      // Pedometer API (limited browser support) - graceful fallback
    }
  },[]);

  const totals=foodLog.reduce((a,f)=>({calories:a.calories+f.calories,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat,fibre:a.fibre+f.fibre}),{calories:0,protein:0,carbs:0,fat:0,fibre:0});
  const goalCal=goals.calories||profile?.calorieGoal||2000;
  const remaining=Math.max(goalCal-totals.calories,0);
  const over=totals.calories>goalCal;
  const fastProg=fast.window>0?Math.min(fastEl/(fast.window*3600),1):0;
  const fastEndStr=fast.start?new Date(fast.start+fast.window*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"--:--";
  const eatEndStr=fast.start?new Date(fast.start+(fast.window+fast.eat)*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"--:--";
  const cuisineKey=profile?.cuisineKey||"nigerian";
  const activeCuisineKey=selectedCuisine||cuisineKey;
  const cuisine=CUISINES[activeCuisineKey]||CUISINES.nigerian;
  const defaultCuisine=CUISINES[cuisineKey]||CUISINES.nigerian;
  const wUnit=profile?.weightUnit||"kg";

  const callProxy=async(messages,maxTokens=1000)=>{
    const res=await fetch("/api/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,max_tokens:maxTokens})});
    if(!res.ok) throw new Error("proxy failed");
    return res.json();
  };

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
        {type:"text",text:`Analyse this food. The user is ${profile?.nationality||"Nigerian"} so consider local dishes. Return ONLY raw JSON: name, calories (number), protein (grams), carbs (grams), fat (grams), fibre (grams), sodium (mg), sugar (grams), confidence ("high"/"medium"/"low"), notes (one sentence), isProcessed (boolean).`}
      ]}]);
      const txt=data.content?.find(b=>b.type==="text")?.text||"{}";
      setAR(JSON.parse(txt.replace(/```json|```/g,"").trim()));
    } catch{setAE("Couldn't analyse. Check connection or enter manually.");}
    finally{setANZ(false);}
  };

  const analyzeVoice=async txt=>{
    setANZ(true);setAE(null);
    try {
      const data=await callProxy([{role:"user",content:`User described food: "${txt}". Nationality: ${profile?.nationality||"Nigerian"}. Return ONLY raw JSON: name, calories (number), protein (grams), carbs (grams), fat (grams), fibre (grams), confidence, notes (one sentence), isProcessed (boolean).`}]);
      const t=data.content?.find(b=>b.type==="text")?.text||"{}";
      setAR(JSON.parse(t.replace(/```json|```/g,"").trim()));
    } catch{setAE("Couldn't parse. Enter manually.");}
    finally{setANZ(false);}
  };

  const getCoach=async()=>{
    setCL(true);
    try {
      const ctx={calories:totals.calories,goal:goalCal,water,schedule:profile?.schedule,name:profile?.name,nationality:profile?.nationality,meals:foodLog.length,weightTrend:weights.length>=2?weights[weights.length-1].weight-weights[0].weight:null,steps};
      const data=await callProxy([{role:"user",content:`Personalised nutrition coach for ${ctx.name}, ${ctx.nationality}, works ${ctx.schedule}. Data: ${JSON.stringify(ctx)}. Give ONE specific insight (2-3 sentences). Warm, practical. Plain text only.`}],300);
      setCM(data.content?.find(b=>b.type==="text")?.text||"Keep logging — patterns emerge over time.");
    } catch{setCM("Keep logging — your patterns will emerge and that's where real progress starts.");}
    finally{setCL(false);}
  };

  const voice=useVoice(txt=>{setVT(txt);analyzeVoice(txt);});
  const saveMood=()=>{setML(p=>[...p,{date:todayStr(),time:timeStr(),moodBefore:moodB,hungerBefore:hungerB,moodAfter:moodA}]);setPM(null);};
  const addWeight=()=>{if(!newWt)return;setWts(p=>[...p,{date:todayStr(),weight:+newWt}].sort((a,b)=>a.date.localeCompare(b.date)));setNW("");setSW(false);};

  const nigerFiltered=cuisine.foods.filter(f=>f.name.toLowerCase().includes(nigerSearch.toLowerCase()));
  const procPct=foodLog.length?Math.round((foodLog.filter(f=>f.isProcessed).length/foodLog.length)*100):0;

  const CRAVE_MAP={
    hunger:{title:"Real Hunger",color:C.red,action:"Your body needs fuel — eat a proper meal.",options:[{l:"Find food near me 🗺️",a:()=>window.open("https://maps.google.com?q=restaurants+near+me","_blank")},{l:"Rice + any protein",a:null},{l:"Eggs + toast (8 min)",a:null}]},
    boredom:{title:"Boredom",color:C.accent,action:"Try a 5-min distraction first.",options:[{l:"Walk route nearby 🗺️",a:()=>window.open("https://maps.google.com?q=parks+near+me","_blank")},{l:"Call a friend 📞",a:()=>window.open("tel:","_self")},{l:"Drink water first",a:null}]},
    stress:{title:"Stress",color:C.grape,action:"A small planned snack beats grazing.",options:[{l:"Handful of nuts",a:null},{l:"Fresh fruit",a:null},{l:"Herbal tea",a:null}]},
    habit:{title:"Habit",color:C.yellow,action:"Notice the trigger — then decide.",options:[{l:"Wait 10 minutes",a:null},{l:"Drink water first",a:null},{l:"Small planned snack",a:null}]},
  };

  // ── AUTH LOADING ────────────────────────────────────────────────────────
  if(authLoading) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <style>{CSS}</style>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:12}}>🌱</div>
      <div style={{fontSize:13,color:C.muted2}}>Loading Nourish...</div>
    </div>
  </div>;

  // ── LOGIN SCREEN ───────────────────────────────────────────────────────
  if(!user&&authScreen) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <style>{CSS}</style>
    <Big style={{fontSize:48,marginBottom:8,textAlign:"center"}}>Sign in to<br/><span style={{color:C.green}}>sync your data</span></Big>
    <div style={{fontSize:13,color:C.muted2,marginBottom:32,textAlign:"center",maxWidth:320,lineHeight:1.6}}>Your food logs, weight, moods, and profile — backed up and synced across all your devices.</div>
    <PrimaryBtn onClick={async()=>{try{await signInWithPopup(auth,googleProvider);}catch(e){console.log("Auth error:",e);}}} style={{maxWidth:360,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Continue with Google
    </PrimaryBtn>
    <button onClick={()=>setAuthScreen(false)} style={{background:"none",border:"none",color:C.muted2,marginTop:16,fontSize:13,fontFamily:"'DM Mono',monospace"}}>← Continue without account</button>
  </div>;

  if(!hasProfile) return <Onboarding onDone={p=>{
    save("profile",p);setPro(p);setHP(true);
    const g={...DEFAULT_GOALS,...(p.macros||{}),calories:p.calorieGoal||2000,water:p.waterGoal||8};
    setGoals(g);save("goals",g);
  }}/>;

  // ── OVERLAYS ──────────────────────────────────────────────────────────────
  if(badDay) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
    <style>{CSS}</style>
    <Big style={{fontSize:48,marginBottom:8}}>Bad Day<br/><span style={{color:C.accent}}>Mode</span></Big>
    <div style={{fontSize:13,color:C.muted2,marginBottom:28,maxWidth:300,lineHeight:1.6}}>No goals. No guilt. Just getting through today — and that's enough.</div>
    {[["💧","Stay hydrated","Water before anything else"],["🍌","Eat something simple","Banana, toast, yoghurt — anything real"],["🚶","Move a little","Even 5 minutes outside counts"],["😴","Rest if you can","Sleep resets almost everything"]].map(([icon,t,s])=><Card key={t} style={{width:"100%",maxWidth:360,textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
      <div style={{fontSize:26}}>{icon}</div>
      <div><div style={{fontWeight:700,fontSize:14}}>{t}</div><div style={{fontSize:12,color:C.muted2}}>{s}</div></div>
    </Card>)}
    <PrimaryBtn onClick={()=>setBD(false)} style={{maxWidth:360,marginTop:16}}>Back to app</PrimaryBtn>
  </div>;

  if(crave) {
    const resp=craveType?CRAVE_MAP[craveType]:null;
    return <div style={{minHeight:"100vh",background:C.bg,padding:24}}>
      <style>{CSS}</style>
      <button onClick={()=>{setCrave(false);setCT(null);}} style={{background:"none",border:"none",color:C.muted2,fontSize:13,marginBottom:20,fontFamily:"'DM Mono',monospace"}}>← Back</button>
      {!craveType?<>
        <Big style={{fontSize:36,marginBottom:4}}>I feel like<br/>snacking</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:24}}>What's actually going on?</div>
        {[["hunger","🍽️","I'm actually hungry","Stomach empty, low energy"],["boredom","😑","Bored / procrastinating","Nothing to do, restless"],["stress","😤","Stressed or anxious","After a hard shift or difficult moment"],["habit","🔄","Force of habit","I always snack at this time"]].map(([k,icon,l,s])=><button key={k} onClick={()=>setCT(k)} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",marginBottom:10,display:"flex",gap:14,cursor:"pointer",color:C.text,textAlign:"left",alignItems:"center"}}>
          <div style={{fontSize:28}}>{icon}</div>
          <div><div style={{fontWeight:700,fontSize:14}}>{l}</div><div style={{fontSize:12,color:C.muted2}}>{s}</div></div>
        </button>)}
      </>:<>
        <Big style={{fontSize:40,color:resp.color,marginBottom:12}}>{resp.title}</Big>
        <Card glow={resp.color}><div style={{fontSize:14,lineHeight:1.6}}>{resp.action}</div></Card>
        <Label style={{marginTop:8}}>Options</Label>
        {resp.options.map((o,i)=><button key={i} onClick={o.a||undefined} style={{width:"100%",background:C.card2,border:`1px solid ${o.a?resp.color+"44":C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:8,fontSize:14,color:o.a?resp.color:C.text,cursor:o.a?"pointer":"default",textAlign:"left",fontWeight:o.a?700:400}}>{o.l}</button>)}
        <button onClick={()=>setCT(null)} style={{background:"none",border:"none",color:C.muted2,fontSize:12,marginTop:6,fontFamily:"'DM Mono',monospace"}}>← Try a different answer</button>
      </>}
    </div>;
  }

  if(postMeal) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <style>{CSS}</style>
    <div style={{maxWidth:400,width:"100%"}}>
      {postMeal.step==="before"?<>
        <Big style={{fontSize:36,marginBottom:4}}>Before<br/>you eat</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:20}}>15 seconds. Builds real insight over time.</div>
        <Card><Label>How hungry are you?</Label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {HUNGER_L.map((h,i)=><button key={i} onClick={()=>setHB(i)} style={{flex:1,minWidth:55,background:hungerB===i?C.accent+"33":"transparent",color:hungerB===i?C.accent:C.muted2,border:`1px solid ${hungerB===i?C.accent:C.border}`,borderRadius:10,padding:"8px 4px",fontSize:10,fontWeight:600,textAlign:"center"}}>{h}</button>)}
          </div>
        </Card>
        <Card><Label>Current mood</Label>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {MOODS.map((m,i)=><button key={i} onClick={()=>setMB(i)} style={{fontSize:28,background:"none",border:`2px solid ${moodB===i?C.grape:C.border}`,borderRadius:"50%",width:50,height:50,transform:moodB===i?"scale(1.2)":"scale(1)",transition:"transform .2s"}}>{m}</button>)}
          </div>
        </Card>
        <PrimaryBtn onClick={()=>setPM({...postMeal,step:"after"})}>Log & Eat →</PrimaryBtn>
        <div style={{textAlign:"center",marginTop:12}}><button onClick={()=>setPM(null)} style={{background:"none",border:"none",color:C.muted2,fontSize:12,fontFamily:"'DM Mono',monospace"}}>Skip check-in</button></div>
      </>:<>
        <Big style={{fontSize:36,marginBottom:4}}>How do you<br/>feel now?</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:20}}>After eating</div>
        <Card><Label>Mood after eating</Label>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {MOODS.map((m,i)=><button key={i} onClick={()=>setMA(i)} style={{fontSize:28,background:"none",border:`2px solid ${moodA===i?C.green:C.border}`,borderRadius:"50%",width:50,height:50,transform:moodA===i?"scale(1.2)":"scale(1)",transition:"transform .2s"}}>{m}</button>)}
          </div>
        </Card>
        <PrimaryBtn onClick={saveMood} style={{background:C.green}}>Save Check-in ✓</PrimaryBtn>
      </>}
    </div>
  </div>;

  // ── MAIN ─────────────────────────────────────────────────────────────────
  const NAV=[{id:"home",icon:"⬡",label:"Home"},{id:"log",icon:"＋",label:"Log"},{id:"fast",icon:"◎",label:"Fast"},{id:"coach",icon:"✦",label:"Coach"},{id:"insight",icon:"◈",label:"Insight"}];

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,maxWidth:480,margin:"0 auto",paddingBottom:80}}>
    <style>{CSS}</style>

    {/* Header */}
    <div style={{padding:"18px 18px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.bg,zIndex:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {user?.photoURL&&<img src={user.photoURL} alt="" style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${C.green}`}}/>}
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,letterSpacing:-0.5}}>NOURISH</div>
          <div style={{fontSize:11,color:C.muted2}}>{now.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} · {profile?.name}{user?" · ☁️":""}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{setCrave(true);setCT(null);}} style={{background:C.grape+"22",border:`1px solid ${C.grape}44`,borderRadius:99,padding:"5px 11px",fontSize:11,color:C.grape,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>craving?</button>
        <button onClick={()=>setBD(true)} style={{background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:99,padding:"5px 11px",fontSize:11,color:C.accent,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>bad day</button>
      </div>
    </div>

    {/* Nav */}
    <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
      {NAV.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.white:"transparent"}`,color:tab===t.id?C.white:C.muted,padding:"10px 4px",fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",display:"flex",flexDirection:"column",alignItems:"center",gap:1,transition:"all .2s"}}>
        <span style={{fontSize:15}}>{t.icon}</span>{t.label}
      </button>)}
    </div>

    <div style={{padding:"16px",animation:"slideUp .3s ease"}}>

      {/* HOME */}
      {tab==="home"&&<>
        {/* Calorie bar — MacroFactor style */}
        <Card glow={over?C.red:null} style={{padding:"18px 18px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <Label style={{marginBottom:4}}>Calories today</Label>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:46,letterSpacing:-2,lineHeight:1}}>{totals.calories}<span style={{fontSize:16,color:C.muted2,fontWeight:400,letterSpacing:0}}> / {goalCal}</span></div>
              <div style={{fontSize:12,color:over?C.red:C.muted2,marginTop:2}}>{over?`${totals.calories-goalCal} over goal`:`${remaining} remaining`}</div>
            </div>
            <Ring value={totals.calories} max={goalCal} color={over?C.red:C.accent} size={72} stroke={7}>
              <div style={{fontSize:12,fontWeight:700,color:over?C.red:C.accent,fontFamily:"'DM Mono',monospace"}}>{Math.min(Math.round((totals.calories/goalCal)*100),100)}%</div>
            </Ring>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
            {[{l:"Protein",v:totals.protein,u:"g",c:"#FFB3B3",bg:"#3A1A1A"},{l:"Fat",v:totals.fat,u:"g",c:"#FFE0A0",bg:"#3A2E0A"},{l:"Carbs",v:totals.carbs,u:"g",c:"#B3EFD4",bg:"#0A3020"},{l:"Fibre",v:totals.fibre,u:"g",c:C.grape,bg:C.grape+"22"}].map(({l,v,u,c,bg})=><div key={l} style={{background:bg,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:800,color:c,fontFamily:"'Barlow Condensed',sans-serif"}}>{v}<span style={{fontSize:9}}>{u}</span></div>
              <div style={{fontSize:9,color:C.muted2}}>{l}</div>
            </div>)}
          </div>
        </Card>

        {/* Steps */}
        <StepsCard steps={steps} goal={10000}/>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <SecBtn onClick={()=>setSteps(s=>Math.max(0,s-1000))} style={{flex:1}}>−1000</SecBtn>
          <SecBtn onClick={()=>setSteps(s=>s+1000)} color={C.green} style={{flex:1}}>+1000 steps</SecBtn>
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:12,textAlign:"center"}}>Auto step count requires a native app. Tap to log manually or connect Google Fit below.</div>

        {/* Water */}
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <Label style={{marginBottom:0}}>Water · {water}/{goals.water||8} glasses</Label>
            <div style={{display:"flex",gap:6}}>
              <SecBtn onClick={()=>setWater(w=>Math.max(0,w-1))} style={{padding:"5px 12px",fontSize:12}}>−</SecBtn>
              <SecBtn onClick={()=>setWater(w=>w+1)} color={C.green} style={{padding:"5px 12px",fontSize:12}}>+ Glass</SecBtn>
            </div>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {Array.from({length:goals.water||8}).map((_,i)=><div key={i} onClick={()=>setWater(i<water?i:i+1)} style={{fontSize:20,cursor:"pointer",opacity:i<water?1:.2,transform:i<water?"scale(1.1)":"scale(1)",transition:"all .2s"}}>💧</div>)}
          </div>
        </Card>

        {/* Today's meals */}
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <Label style={{marginBottom:0}}>Today's Meals</Label>
            <SecBtn onClick={()=>setTab("log")} color={C.green} style={{padding:"5px 14px",fontSize:12}}>+ Add</SecBtn>
          </div>
          {foodLog.length===0&&<div style={{color:C.muted2,fontSize:13,textAlign:"center",padding:"16px 0"}}>Nothing logged yet</div>}
          {foodLog.map(item=><div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            {item.image?<img src={item.image} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:8,background:C.card2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🍽️</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{item.name}</div>
              <div style={{display:"flex",gap:4}}><Pill color={C.red} sm>{item.calories}kcal</Pill><Pill color={C.accent} sm>{item.protein}g P</Pill>{item.isProcessed&&<Pill color={C.red} sm>processed</Pill>}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:10,color:C.muted2,marginBottom:2}}>{item.time}</div>
              <button onClick={()=>delFood(item.id)} style={{background:"none",border:"none",color:C.muted2,fontSize:18}}>×</button>
            </div>
          </div>)}
        </Card>

        {/* Weekly macro grid */}
        <Card>
          <Label>Weekly Programme</Label>
          <MacroGrid goals={{targetCals:goalCal,protein:goals.protein||150,fat:goals.fat||65,carbs:goals.carbs||200}} profile={profile}/>
          <button onClick={()=>setSCI(true)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:99,padding:"6px 16px",fontSize:11,color:C.muted2,marginTop:12,fontFamily:"'DM Mono',monospace"}}>View weekly check-in →</button>
        </Card>
      </>}

      {/* LOG */}
      {tab==="log"&&<>
        <Big style={{fontSize:36,marginBottom:4}}>Log Food</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:14}}>Photo, voice, local DB, or manual</div>

        <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
          {["Breakfast","Lunch","Dinner","Snack","Post-workout"].map(m=><button key={m} onClick={()=>setMT(m)} style={{background:mealType===m?C.white:C.card2,color:mealType===m?"#000":C.muted2,border:`1px solid ${mealType===m?C.white:C.border}`,borderRadius:99,padding:"6px 14px",fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{m}</button>)}
        </div>

        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
          {[["photo","📸 Photo"],["voice","🎙️ Voice"],["cuisine",`${defaultCuisine.flag} Food DB`],["manual","✏️ Manual"]].map(([k,l])=><button key={k} onClick={()=>setLM(k)} style={{background:logMode===k?C.accent:C.card2,color:logMode===k?C.white:C.muted2,border:`1px solid ${logMode===k?C.accent:C.border}`,borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{l}</button>)}
        </div>

        {logMode==="photo"&&<Card>
          <Label>AI Photo Analysis</Label>
          {!uploadImg?<button onClick={()=>fileRef.current.click()} style={{width:"100%",background:C.card2,border:`2px dashed ${C.accent}44`,borderRadius:12,padding:"28px 0",color:C.accent,fontSize:14,fontWeight:700}}>Tap to upload food photo</button>:<div>
            <img src={uploadImg} alt="" style={{width:"100%",borderRadius:10,maxHeight:200,objectFit:"cover",marginBottom:10}}/>
            <div style={{display:"flex",gap:8}}>
              <PrimaryBtn onClick={analyzePhoto} disabled={analyzing} style={{flex:1,padding:"12px 0",fontSize:14}}>{analyzing?"Analysing...":"Analyse with AI"}</PrimaryBtn>
              <button onClick={()=>{setUI(null);setUD(null);setAR(null);}} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 14px",color:C.muted2,fontSize:20}}>×</button>
            </div>
          </div>}
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
          {analyzing&&<div style={{textAlign:"center",padding:"14px 0",color:C.muted2}}><div style={{fontSize:22,animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</div><div style={{fontSize:12,marginTop:4}}>Identifying food and nutrients...</div></div>}
          {aiErr&&<div style={{color:C.red,fontSize:12,padding:"8px 12px",background:C.red+"11",borderRadius:8,marginTop:8}}>{aiErr}</div>}
          {aiResult&&!voiceText&&<AiCard result={aiResult} image={uploadImg} onAdd={addFood}/>}
        </Card>}

        {logMode==="voice"&&<Card>
          <Label>Voice Input</Label>
          <PrimaryBtn onClick={voice.listening?voice.stop:voice.start} style={{background:voice.listening?C.red:C.grape,color:"#fff",marginBottom:10}}>{voice.listening?"🔴 Listening... tap to stop":"🎙️ Tap & Speak"}</PrimaryBtn>
          {voiceText&&<div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:13,marginBottom:8,border:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.muted2,marginBottom:2}}>YOU SAID</div>"{voiceText}"</div>}
          {analyzing&&voiceText&&<div style={{textAlign:"center",padding:"10px 0",color:C.muted2}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⚙️</span> Estimating...</div>}
          {aiResult&&voiceText&&<AiCard result={aiResult} image={null} onAdd={addFood}/>}
          <div style={{fontSize:11,color:C.muted2,marginTop:8}}>Try: "bowl of {cuisine.foods[0]?.name.split("(")[0].trim().toLowerCase()}" or "2 boiled eggs and toast"</div>
        </Card>}

        {logMode==="cuisine"&&<Card>
          <Label>{cuisine.flag} {cuisine.label} Foods</Label>
          <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
            {Object.entries(CUISINES).map(([key,c])=><button key={key} onClick={()=>setSC(key)} style={{background:activeCuisineKey===key?C.accent:C.card2,color:activeCuisineKey===key?C.white:C.muted2,border:`1px solid ${activeCuisineKey===key?C.accent:C.border}`,borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{c.flag} {c.label.split(" ")[1]||c.label}</button>)}
          </div>
          <input value={nigerSearch} onChange={e=>setNS(e.target.value)} placeholder={`Search ${cuisine.foods.length} dishes...`} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,marginBottom:10}}/>
          <div style={{maxHeight:420,overflowY:"auto"}}>
            {nigerFiltered.map(f=><button key={f.name} onClick={()=>addFood({name:f.name,calories:f.cal,protein:f.p,carbs:f.c,fat:f.f,fibre:f.fi,sodium:0,sugar:0,isProcessed:false,image:null})} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",color:C.text,textAlign:"left"}}>
              <div>
                <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{f.name}</div>
                <div style={{display:"flex",gap:4}}><Pill color={C.red} sm>{f.cal}kcal</Pill><Pill color={C.accent} sm>{f.p}g P</Pill><Pill color={C.yellow} sm>{f.c}g C</Pill><Pill color={C.lime} sm>{f.f}g F</Pill></div>
              </div>
              <span style={{color:C.green,fontSize:22,flexShrink:0}}>+</span>
            </button>)}
          </div>
        </Card>}

        {logMode==="manual"&&<Card>
          <Label>Manual Entry</Label>
          {[{k:"name",l:"Food name",ph:"e.g. "+cuisine.foods[0]?.name,type:"text"},{k:"calories",l:"Calories (kcal)",ph:"450",type:"number"},{k:"protein",l:"Protein (g)",ph:"25",type:"number"},{k:"carbs",l:"Carbs (g)",ph:"60",type:"number"},{k:"fat",l:"Fat (g)",ph:"12",type:"number"},{k:"fibre",l:"Fibre (g)",ph:"4",type:"number"}].map(({k,l,ph,type})=><div key={k} style={{marginBottom:10}}>
            <Label>{l}</Label>
            <input value={manual[k]} onChange={e=>setMan(p=>({...p,[k]:e.target.value}))} type={type} placeholder={ph} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:14}}/>
          </div>)}
          <PrimaryBtn onClick={()=>{if(!manual.name||!manual.calories)return;addFood({name:manual.name,calories:+manual.calories||0,protein:+manual.protein||0,carbs:+manual.carbs||0,fat:+manual.fat||0,fibre:+manual.fibre||0,sodium:0,sugar:0,image:null,isProcessed:false});}}>Add to Log</PrimaryBtn>
        </Card>}
      </>}

      {/* FAST */}
      {tab==="fast"&&<>
        <Big style={{fontSize:36,marginBottom:4}}>Fasting<br/>Timer</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:14}}>Flexible windows — built for shift workers.</div>

        <Card glow={C.accent}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:700,fontSize:14,marginBottom:2}}>🌙 Night Shift Mode</div><div style={{fontSize:12,color:C.muted2}}>Fast during shift · Eat after waking</div></div>
            <button onClick={()=>setFast(f=>({...f,shiftMode:!f.shiftMode}))} style={{width:48,height:26,borderRadius:99,background:fast.shiftMode?C.accent:C.border,border:"none",position:"relative",flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:fast.shiftMode?24:4,transition:"left .3s"}}/>
            </button>
          </div>
        </Card>

        {!fast.active&&<Card>
          <Label>Protocol</Label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {[["16:8",16,8],["18:6",18,6],["20:4",20,4],["14:10",14,10]].map(([l,f,e])=><button key={l} onClick={()=>setFast(s=>({...s,window:f,eat:e}))} style={{background:fast.window===f?C.white:C.card2,color:fast.window===f?"#000":C.muted2,border:`1px solid ${fast.window===f?C.white:C.border}`,borderRadius:99,padding:"7px 16px",fontSize:13,fontWeight:700}}>{l}</button>)}
          </div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}><Label>Fast (hrs)</Label><input value={fast.window} onChange={e=>setFast(s=>({...s,window:+e.target.value}))} type="number" style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:16,fontWeight:700}}/></div>
            <div style={{flex:1}}><Label>Eat (hrs)</Label><input value={fast.eat} onChange={e=>setFast(s=>({...s,eat:+e.target.value}))} type="number" style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:16,fontWeight:700}}/></div>
          </div>
        </Card>}

        <Card glow={fast.active?C.accent:null} style={{textAlign:"center",padding:"28px 20px"}}>
          <div style={{fontSize:10,color:C.muted2,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:14}}>{fast.active?"Fasting in progress":"Ready to start"}</div>
          <Ring value={fastEl} max={fast.window*3600} color={C.accent} size={170} stroke={10}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:30,letterSpacing:-1}}>{fmtT(fastEl)}</div>
              <div style={{fontSize:11,color:C.muted2}}>/ {fast.window}h goal</div>
              <div style={{fontSize:13,color:C.accent,marginTop:2,fontWeight:700}}>{Math.round(fastProg*100)}%</div>
            </div>
          </Ring>
          {fast.active&&<div style={{marginTop:14,marginBottom:6}}>
            <div style={{fontSize:14,color:C.green,fontWeight:700}}>🍽️ Eating window opens {fastEndStr}</div>
            <div style={{fontSize:12,color:C.muted2}}>Closes {eatEndStr} · {fast.eat}h window</div>
          </div>}
          <div style={{marginTop:16}}>
            <PrimaryBtn onClick={()=>{if(fast.active){setFast(s=>({...s,active:false,start:null}));setFE(0);}else setFast(s=>({...s,active:true,start:Date.now()}));}} style={{width:"auto",display:"inline-block",padding:"12px 36px"}}>
              {fast.active?"End Fast":fast.shiftMode?"Start Shift Fast":"Start Fast"}
            </PrimaryBtn>
          </div>
        </Card>
      </>}

      {/* COACH */}
      {tab==="coach"&&<>
        <Big style={{fontSize:36,marginBottom:4}}>AI Coach</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:14}}>Personalised to {profile?.name} · {profile?.nationality} · {profile?.schedule}</div>

        <Card glow={C.green} style={{textAlign:"center",padding:"24px 16px"}}>
          {coachLoad?<div><div style={{fontSize:28,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:8}}>✦</div><div style={{fontSize:13,color:C.muted2}}>Analysing your patterns...</div></div>:coachMsg?<div>
            <div style={{fontSize:22,marginBottom:8}}>🌱</div>
            <div style={{fontSize:14,lineHeight:1.8,fontStyle:"italic",marginBottom:16}}>"{coachMsg}"</div>
            <SecBtn onClick={getCoach} color={C.green}>Get another insight</SecBtn>
          </div>:<div>
            <Big style={{fontSize:44,marginBottom:10}}>✦</Big>
            <div style={{fontSize:13,color:C.muted2,marginBottom:16,lineHeight:1.6}}>Personalised insight using your food log, mood check-ins, fasting, steps, and weight trend.</div>
            <PrimaryBtn onClick={getCoach}>Get my insight</PrimaryBtn>
          </div>}
        </Card>

        {/* Connector actions */}
        <Card>
          <Label>App Connectors</Label>

          {/* Step Counter */}
          <div style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:20}}>🏃</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
                  <div style={{fontWeight:600,fontSize:13}}>Step Counter</div>
                  <Pill color={C.green} sm>Active</Pill>
                </div>
                <div style={{fontSize:11,color:C.muted2}}>Today: {steps.toLocaleString()} steps</div>
              </div>
            </div>
            {showStepInput?<div style={{display:"flex",gap:8}}>
              <input value={manualSteps} onChange={e=>setManualSteps(e.target.value)} type="number" placeholder="Enter steps" style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14}}/>
              <SecBtn onClick={()=>{if(manualSteps){setSteps(s=>s+ +manualSteps);setManualSteps("");setShowStepInput(false);}}} color={C.green} style={{padding:"0 16px"}}>Add</SecBtn>
              <SecBtn onClick={()=>setShowStepInput(false)} style={{padding:"0 12px"}}>✕</SecBtn>
            </div>:<div style={{display:"flex",gap:6}}>
              <SecBtn onClick={()=>setSteps(s=>s+1000)} color={C.green} style={{padding:"6px 14px",fontSize:11}}>+1000</SecBtn>
              <SecBtn onClick={()=>setSteps(s=>s+2500)} color={C.green} style={{padding:"6px 14px",fontSize:11}}>+2500</SecBtn>
              <SecBtn onClick={()=>setShowStepInput(true)} color={C.accent} style={{padding:"6px 14px",fontSize:11}}>Custom</SecBtn>
            </div>}
          </div>

          {/* Fitness Tracker / Workout Logger */}
          <div style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:20}}>🏋️</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
                  <div style={{fontWeight:600,fontSize:13}}>Workout Logger</div>
                  <Pill color={C.green} sm>Active</Pill>
                </div>
                <div style={{fontSize:11,color:C.muted2}}>Log calories burned from exercise</div>
              </div>
            </div>
            {showWorkout?<div style={{display:"flex",gap:8}}>
              <input value={workoutCals} onChange={e=>setWC(e.target.value)} type="number" placeholder="Calories burned" style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14}}/>
              <SecBtn onClick={()=>{if(workoutCals){addFood({name:`Workout (-${workoutCals}kcal)`,calories:-Math.abs(+workoutCals),protein:0,carbs:0,fat:0,fibre:0,sodium:0,sugar:0,isProcessed:false,image:null});setWC("");setShowWorkout(false);}}} color={C.green} style={{padding:"0 16px"}}>Log</SecBtn>
              <SecBtn onClick={()=>setShowWorkout(false)} style={{padding:"0 12px"}}>✕</SecBtn>
            </div>:<div style={{display:"flex",gap:6}}>
              <SecBtn onClick={()=>setShowWorkout(true)} color={C.accent} style={{padding:"6px 14px",fontSize:11}}>Log Workout</SecBtn>
            </div>}
          </div>

          {/* Export Data */}
          <div style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:20}}>📤</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>Export Data</div>
                <div style={{fontSize:11,color:C.muted2}}>Download your food log, weight, and mood data</div>
              </div>
            </div>
            <SecBtn onClick={()=>{
            const data={profile,foodLog,weights,moodLog,goals,steps,water,fast};
            const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
            const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`nourish_export_${todayStr()}.json`;a.click();
          }} color={C.accent} style={{padding:"6px 14px",fontSize:11,marginRight:8}}>Download JSON</SecBtn>
          <SecBtn onClick={()=>{
            const data = {};
            for(let i=0; i<localStorage.length; i++){
              const k = localStorage.key(i);
              if(k.startsWith("n4_")) data[k] = JSON.parse(localStorage.getItem(k));
            }
            const code = btoa(JSON.stringify(data));
            navigator.clipboard.writeText(code);
            alert("Sync code copied! Save this code to restore your data on any device.");
          }} color={C.accent} style={{padding:"6px 14px",fontSize:11}}>Copy Sync Code</SecBtn>
          </div>

          {/* Google Fit / Apple Health */}
          <div style={{padding:"12px 0"}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{fontSize:20}}>📱</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
                  <div style={{fontWeight:600,fontSize:13}}>Google Fit / Apple Health</div>
                  <Pill color={C.muted2} sm>Native only</Pill>
                </div>
                <div style={{fontSize:11,color:C.muted2,lineHeight:1.5}}>Direct sync requires a native app. Use Export Data above to manually transfer your data.</div>
              </div>
            </div>
          </div>
        </Card>

        {moodLog.length>0&&<Card>
          <Label>Mood After Meals</Label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {moodLog.slice(-10).map((m,i)=><div key={i} style={{background:C.card2,borderRadius:8,padding:"7px 8px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:18}}>{MOODS[m.moodAfter]}</div>
              <div style={{fontSize:9,color:C.muted2,marginTop:1}}>{m.time}</div>
            </div>)}
          </div>
        </Card>}
      </>}

      {/* INSIGHT */}
      {tab==="insight"&&<>
        <Big style={{fontSize:36,marginBottom:4}}>Insights</Big>
        <div style={{fontSize:13,color:C.muted2,marginBottom:14}}>Your data — turned into understanding.</div>

        <Card>
          <Label>Today</Label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{l:"Calories",v:totals.calories,u:"kcal",c:C.red},{l:"Protein",v:totals.protein,u:"g",c:C.accent},{l:"Carbs",v:totals.carbs,u:"g",c:C.yellow},{l:"Fat",v:totals.fat,u:"g",c:C.lime},{l:"Fibre",v:totals.fibre,u:"g",c:C.grape},{l:"Water",v:water,u:"gl",c:C.green}].map(({l,v,u,c})=><div key={l} style={{background:C.card2,borderRadius:10,padding:"12px 8px",textAlign:"center",border:`1px solid ${c}22`}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:c}}>{v}<span style={{fontSize:10,color:C.muted2}}>{u}</span></div>
              <div style={{fontSize:10,color:C.muted2,marginTop:2}}>{l}</div>
            </div>)}
          </div>
        </Card>

        <Card>
          <Label>Weight Trend</Label>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:12,color:C.muted2}}>Unit: {wUnit}</div>
            <SecBtn onClick={()=>setSW(true)} color={C.accent} style={{padding:"5px 12px",fontSize:11}}>+ Log Weight</SecBtn>
          </div>
          {showWt&&<div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={newWt} onChange={e=>setNW(e.target.value)} type="number" step="0.1" placeholder={`Weight in ${wUnit}`} style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:15}}/>
            <SecBtn onClick={addWeight} color={C.green} style={{padding:"0 16px"}}>Save</SecBtn>
            <SecBtn onClick={()=>setSW(false)} style={{padding:"0 12px"}}>✕</SecBtn>
          </div>}
          <WeightChart entries={weights} unit={wUnit}/>
        </Card>

        <Card>
          <Label>Programme Overview</Label>
          <MacroGrid goals={{targetCals:goalCal,protein:goals.protein||150,fat:goals.fat||65,carbs:goals.carbs||200}} profile={profile}/>
        </Card>

        <Card>
          <Label>Your Profile</Label>
          {!editProfile?<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[["Name",profile?.name||"—"],["Nationality",profile?.nationality||"—"],["Goal",profile?.goal||"—"],["Schedule",profile?.schedule||"—"],["Cuisine DB",defaultCuisine.label],["Activity",profile?.activityLevel||"—"],["Weight",`${profile?.weight||"—"} ${wUnit}`],["Height",`${profile?.height||"—"} ${profile?.heightUnit||"cm"}`],["Cal target",`${goalCal} kcal`],["Water",`${goals.water||8} gl`]].map(([k,v])=><div key={k} style={{background:C.card2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:2}}>{k.toUpperCase()}</div>
                <div style={{fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{v}</div>
              </div>)}
            </div>
            <SecBtn onClick={()=>{setEP(true);setED({...profile});}} color={C.accent} style={{width:"100%",textAlign:"center"}}>Edit Profile</SecBtn>
          </>:<>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
              {[["name","Name","text"],["nationality","Nationality","text"],["weight","Weight","number"],["height","Height (cm)","number"]].map(([key,label,type])=><div key={key}>
                <div style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:3}}>{label.toUpperCase()}</div>
                <input value={editData?.[key]||""} onChange={e=>setED(d=>({...d,[key]:e.target.value}))} type={type} style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14}}/>
              </div>)}
              <div>
                <div style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:3}}>GOAL</div>
                <div style={{display:"flex",gap:6}}>
                  {["lose","maintain","gain"].map(g=><button key={g} onClick={()=>setED(d=>({...d,goal:g}))} style={{flex:1,background:editData?.goal===g?C.white:C.card2,color:editData?.goal===g?"#000":C.muted2,border:`1px solid ${editData?.goal===g?C.white:C.border}`,borderRadius:10,padding:"8px 0",fontSize:12,fontWeight:700,textTransform:"capitalize"}}>{g}</button>)}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:3}}>ACTIVITY</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[["sedentary","Sedentary"],["light","Light"],["moderate","Moderate"],["active","Active"],["very_active","Very Active"]].map(([v,l])=><button key={v} onClick={()=>setED(d=>({...d,activityLevel:v}))} style={{background:editData?.activityLevel===v?C.white:C.card2,color:editData?.activityLevel===v?"#000":C.muted2,border:`1px solid ${editData?.activityLevel===v?C.white:C.border}`,borderRadius:99,padding:"5px 10px",fontSize:11,fontWeight:700}}>{l}</button>)}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:3}}>SCHEDULE</div>
                <div style={{display:"flex",gap:6}}>
                  {[["shifts","Shifts"],["nine5","9-5"],["freelance","Freelance"]].map(([v,l])=><button key={v} onClick={()=>setED(d=>({...d,schedule:v}))} style={{flex:1,background:editData?.schedule===v?C.accent+"33":C.card2,color:editData?.schedule===v?C.accent:C.muted2,border:`1px solid ${editData?.schedule===v?C.accent:C.border}`,borderRadius:10,padding:"8px 0",fontSize:12,fontWeight:700}}>{l}</button>)}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:3}}>WEIGHT UNIT</div>
                <div style={{display:"flex",gap:6}}>
                  {["kg","lbs"].map(u=><button key={u} onClick={()=>setED(d=>({...d,weightUnit:u}))} style={{flex:1,background:editData?.weightUnit===u?C.white:C.card2,color:editData?.weightUnit===u?"#000":C.muted2,border:`1px solid ${editData?.weightUnit===u?C.white:C.border}`,borderRadius:10,padding:"8px 0",fontSize:13,fontWeight:700}}>{u}</button>)}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <PrimaryBtn onClick={()=>{
                const cuisineK=NATIONALITY_TO_CUISINE[editData.nationality]||profile.cuisineKey||"nigerian";
                const updated={...profile,...editData,cuisineKey:cuisineK};
                const r=calcTDEE(updated);
                updated.calorieGoal=r.targetCals;
                updated.macros=r;
                save("profile",updated);setPro(updated);
                const g={...goals,calories:r.targetCals,protein:r.protein,fat:r.fat,carbs:r.carbs};
                setGoals(g);save("goals",g);
                setEP(false);setED(null);
              }} style={{flex:1}}>Save Changes</PrimaryBtn>
              <SecBtn onClick={()=>{setEP(false);setED(null);}} style={{padding:"0 20px"}}>Cancel</SecBtn>
            </div>
          </>}
        </Card>

        {/* Account / Cloud Sync */}
        <Card>
          <Label>Account & Sync</Label>
          {user?<>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
              {user.photoURL&&<img src={user.photoURL} alt="" style={{width:40,height:40,borderRadius:"50%",border:`2px solid ${C.green}`}}/>}
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{user.displayName||"Signed in"}</div>
                <div style={{fontSize:11,color:C.muted2}}>{user.email}</div>
              </div>
              <Pill color={C.green} sm>☁️ Synced</Pill>
            </div>
            <div style={{fontSize:11,color:C.muted2,marginBottom:12,lineHeight:1.6}}>Your data is backed up to the cloud and syncs across all your devices.</div>
            <SecBtn onClick={async()=>{try{await signOut(auth);}catch(e){console.log(e);}}} color={C.red} style={{width:"100%",textAlign:"center"}}>Sign Out</SecBtn>
          </>:<>
            <div style={{fontSize:13,color:C.muted2,marginBottom:12,lineHeight:1.6}}>Sign in with Google to back up your data and sync across devices. Your current data will be preserved.</div>
            <PrimaryBtn onClick={()=>setAuthScreen(true)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </PrimaryBtn>
          </>}
        </Card>
      </>}

    </div>
  </div>;
}
