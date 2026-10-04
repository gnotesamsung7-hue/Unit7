"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HAS = !!window.Android;

/* ---------- Robot geometry (from the SpiderBot firmware) ---------- */
// Lift servos: N = neutral angle, s = direction that raises the foot.
const LIFT = {0:{N:70,s:1}, 7:{N:70,s:1}, 3:{N:110,s:-1}, 4:{N:110,s:-1}};
const LEGS = {
  LF:{name:"Left front leg", lift:4, swing:5, hip:[112,100], dir:-135, flip:-1},
  RF:{name:"Right front leg",lift:0, swing:1, hip:[188,100], dir:-45,  flip:1},
  LR:{name:"Left rear leg",  lift:7, swing:6, hip:[112,190], dir:135,  flip:-1},
  RR:{name:"Right rear leg", lift:3, swing:2, hip:[188,190], dir:45,   flip:1}
};
const OPPOSITE = {LF:"RR", RR:"LF", RF:"LR", LR:"RF"};
const STAND = [70,90,90,110,110,90,90,70];
const GAIT = {
  forward:[
    [70,90,90,110,110,90,90,70],[90,90,90,110,110,90,45,90],[70,90,90,110,110,90,45,70],
    [70,90,90,90,90,90,45,70],[70,39,141,90,90,90,90,70],[70,39,141,110,110,90,90,70],
    [90,90,141,110,110,90,90,90],[90,90,90,110,110,135,90,90],[70,90,90,110,110,135,90,70],
    [70,90,90,110,90,135,90,70],[70,90,90,110,110,90,90,70]],
  backward:[
    [70,90,90,110,110,90,90,70],[90,45,90,110,110,90,90,90],[70,45,90,110,110,90,90,70],
    [70,45,90,90,90,90,90,70],[70,90,90,90,90,135,45,70],[70,90,90,110,110,135,45,70],
    [90,90,90,110,110,135,90,90],[90,90,135,110,110,90,90,90],[70,90,135,110,110,90,90,70],
    [70,90,135,90,110,90,90,70],[70,90,90,110,110,90,90,70]],
  turnleft:[
    [70,90,90,110,110,90,90,70],[90,90,90,110,110,90,90,90],[90,135,90,110,110,90,135,90],
    [70,135,90,110,110,90,135,70],[70,135,90,90,90,90,135,70],[70,135,135,90,90,135,135,70],
    [70,135,135,110,110,135,135,70],[70,90,90,110,110,90,90,70]],
  turnright:[
    [70,90,90,110,110,90,90,70],[70,90,90,90,90,90,90,70],[70,90,45,90,90,45,90,70],
    [70,90,45,110,110,45,90,70],[90,90,45,110,110,45,90,90],[90,45,45,110,110,45,45,90],
    [70,45,45,110,110,45,45,70],[70,90,90,110,110,90,90,70]]
};
const ACT = {stand:1, forward:2, backward:3, stepleft:4, stepright:5, turnleft:6, turnright:7,
  sit:8, wave:9, fight:10, pushups:11, sleep:12, dance1:13, dance2:14, dance3:15, center:99};
const ACTION_NAMES = {1:"Standing",2:"Walking forward",3:"Walking back",4:"Stepping left",5:"Stepping right",
  6:"Turning left",7:"Turning right",8:"Sitting",9:"Waving",10:"Fight pose",11:"Push-ups",12:"Sleeping",
  13:"Dancing",14:"Dancing",15:"Dancing",21:"Exploring",99:"Centering",100:"Zero pose"};

const isLift = i => Object.prototype.hasOwnProperty.call(LIFT, i);
const liftU = (i,a) => (a - LIFT[i].N) * LIFT[i].s;
const liftA = (i,u) => LIFT[i].N + LIFT[i].s * u;
function clampA(i,a){
  if (isLift(i)) return liftA(i, clamp(liftU(i,a), -25, 55));
  return clamp(a, 40, 140);
}

/* ---------- Preferences ---------- */
const DEFAULTS = {base:"192.168.4.1", talk:true, sfx:true, offline:true, flipStop:true,
  invF:false, invT:false, walk:"builtin", balance:true, role:null, eyesAddr:"", color:"amber", wake:false, lightInv:false};
const P = Object.assign({}, DEFAULTS, (() => { try { return JSON.parse(localStorage.getItem("u7.prefs")) || {}; } catch(e){ return {}; } })());
const savePrefs = () => { try { localStorage.setItem("u7.prefs", JSON.stringify(P)); } catch(e){} };

/* ---------- State ---------- */
const S = {
  online:false, everOnline:false, state:null, pos:null, token:0, custom:null,
  leg:"RF", balanced:null, driving:false, legTilt:false, lastHop:0, listening:false,
  tilt:{p:0, r:0, z:1, p0:0, r0:0, live:false}, flipped:false, tab:"home",
  eyes:{ip:null, bat:null, last:0, linked:false, warned:false}, ctlLast:0
};
const MY_ID = Math.random().toString(36).slice(2, 10);
const isEyes = () => P.role === "eyes";

/* ---------- Native bridge callbacks ---------- */
const pending = {};
let rid = 0;
const U7 = window.U7 = {
  onResponse(id, status, body){ const f = pending[id]; if (f) { delete pending[id]; f({status, body}); } },
  onSpoken(id){ const f = spoken[id]; if (f) { delete spoken[id]; f(); } },
  onHear(kind, data){ heard(kind, data); },
  onTilt(p, r, z){ tiltIn(p, r, z); },
  onTiltMissing(){ $("#gText").textContent = "This phone has no tilt sensor."; },
  onPause(){ if (!isEyes() && (S.driving || S.custom || S.legTilt)) emergencyStop(true); },
  onLink(msg, from){ linkIn(msg, from); }
};

/* ---------- Robot link ---------- */
let lastQuiet = 0;
async function req(method, path){
  const url = "http://" + P.base + path;
  // Tell the Eyes phone the servos are about to make noise, so it doesn't mistake them for claps or waves.
  if (method === "POST" && path !== "/api/v1/stop" && P.role === "ctl" && S.eyes.linked && Date.now() - lastQuiet > 1000) {
    lastQuiet = Date.now(); linkSend({t:"quiet", ms:2500});
  }
  let r;
  if (HAS) {
    const id = "r" + (++rid);
    r = await new Promise(res => { pending[id] = res; Android.request(id, method, url); });
  } else {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
      const f = await fetch(url, {method, signal: ctl.signal}); clearTimeout(t);
      r = {status: f.status, body: await f.text()};
    } catch(e) { r = {status: 0, body: ""}; }
  }
  let json = null; try { json = JSON.parse(r.body); } catch(e) {}
  setOnline(r.status !== 0);
  return {status: r.status, json};
}

function setOnline(on){
  if (on === S.online) return;
  S.online = on;
  $("#dot").classList.toggle("on", on);
  $("#dot").setAttribute("aria-label", on ? "Connected" : "Not connected");
  if (on && !S.everOnline) { S.everOnline = true; if (booted) say(pick("connected")); }
  else if (!on && S.everOnline) { S.driving = false; $("#driveBtn").classList.remove("held"); }
  renderStatus();
}

const robotBusy = () => { const s = S.state; return !!(s && (s.busy || s.requested_action_id)); };
function renderStatus(){
  let t;
  if (!S.online) t = "Not connected. Join the robot’s Wi-Fi.";
  else if (S.custom) t = S.custom;
  else if (robotBusy()) t = ACTION_NAMES[S.state.current_action_id || S.state.requested_action_id] || "Moving";
  else t = "Ready for work orders";
  $("#statusLine").textContent = t;
}
async function refreshState(){
  const r = await req("GET", "/api/v1/state");
  if (r.json && r.json.ok) S.state = r.json.data;
  renderStatus();
  return S.state;
}
setInterval(() => { if (P.role === "ctl" && !S.custom && !S.driving) refreshState(); }, 1500);

async function waitIdle(maxMs){
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    await sleep(250);
    const s = await refreshState();
    if (s && !s.busy && !s.requested_action_id) return true;
  }
  return false;
}

async function runAction(id){
  S.token++; S.custom = null; S.pos = null;
  if (S.state) S.state.requested_action_id = id;
  const r = await req("POST", "/api/v1/action?id=" + id);
  renderStatus();
  return r.status !== 0;
}

async function emergencyStop(silent){
  if (window.playStop) playStop();
  S.token++; S.custom = null; S.driving = false; S.legTilt = false;
  $("#driveBtn").classList.remove("held"); $("#legTiltBtn").classList.remove("held");
  await req("POST", "/api/v1/stop");
  S.pos = null;
  setTimeout(refreshState, 300);
  if (!silent) say(pick("emergency"));
}

// Built-in actions block direct servo commands, so end any that is running.
async function makeRoom(){
  const s = await refreshState();
  if (s && (s.busy || s.requested_action_id)) { await req("POST", "/api/v1/stop"); await waitIdle(2500); }
}

async function applyPose(target, tok, parallel){
  const full = !S.pos;
  const prev = S.pos ? S.pos.slice() : new Array(8).fill(null);
  const t = target.map((a,i) => Math.round(clampA(i,a)));
  const changed = [0,1,2,3,4,5,6,7].filter(i => full || prev[i] !== t[i]);
  if (parallel) {
    // Fire all at once so the servos move together (used for the hop).
    await Promise.all(changed.map(i => req("POST", "/api/v1/servo?servo=" + i + "&value=" + t[i])));
    S.pos = t;
    return tok === undefined || tok === S.token;
  }
  // Raise feet first, then swing, then lower feet: a foot never drags.
  const rank = i => !isLift(i) ? 1 : (prev[i] == null || liftU(i,t[i]) > liftU(i,prev[i]) ? 0 : 2);
  changed.sort((a,b) => rank(a) - rank(b));
  S.pos = prev;
  for (const i of changed) {
    if (tok !== undefined && tok !== S.token) { if (S.pos.some(v => v == null)) S.pos = null; return false; }
    await req("POST", "/api/v1/servo?servo=" + i + "&value=" + t[i]);
    S.pos[i] = t[i];
  }
  return true;
}

/* ---------- Unit 7's voice ---------- */
function pick(key, vars){
  const list = LINES[key] || LINES.unknown;
  const [mood, text] = list[Math.floor(Math.random() * list.length)];
  return {mood, text: vars ? text.replace(/\{(\w+)\}/g, (m,k) => vars[k]) : text};
}
let sayChain = Promise.resolve(), sayTok = 0, spokenId = 0;
const spoken = {};
function say(line){
  const tok = sayTok;
  sayChain = sayChain.then(() => tok === sayTok ? doSay(line, tok) : null).catch(() => {});
  return sayChain;
}
function hush(){ sayTok++; if (P.role === "ctl" && S.eyes.linked) linkSend({t:"hush"}); if (HAS) Android.stopSpeaking(); Object.keys(spoken).forEach(k => U7.onSpoken(k)); }
async function doSay({mood, text}, tok){
  if (P.role === "ctl" && S.eyes.linked) return remoteSay({mood, text}, tok);
  setMood(mood);
  $("#says").innerHTML = text.replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))
    .replace(/\[(.+?)\]/g, '<span class="tic">[$1]</span>');
  const parts = text.split(/(\[[^\]]+\])/).map(s => s.trim()).filter(Boolean);
  S.speaking = true;
  for (const part of parts) {
    if (tok !== sayTok) return;
    const tic = part.match(/^\[(.+)\]$/);
    if (tic) { if (P.sfx) await sfx(tic[1]); continue; }
    if (P.talk && HAS) await speakNative(part);
    else await sleep(Math.min(4000, 400 + part.length * 45));
  }
  S.speaking = false; S.spokeAt = Date.now();
  if (tok === sayTok && !S.listening) setMood(restMood());
}
// After a card, its mood lingers for a few seconds before Unit 7 relaxes.
function restMood(){
  if (S.hold && Date.now() < S.hold.until) {
    const h = S.hold;
    clearTimeout(S.holdT);
    S.holdT = setTimeout(() => { if ($("#visor").dataset.mood === h.m) setMood(restMood()); }, h.until - Date.now());
    return h.m;
  }
  return S.driving || S.custom ? "busy" : "idle";
}
function speakNative(text){
  const id = "s" + (++spokenId);
  return new Promise(res => {
    const t = setTimeout(() => { delete spoken[id]; res(); }, Math.max(3000, text.length * 120));
    spoken[id] = () => { clearTimeout(t); res(); };
    Android.speak(id, text);
  });
}

/* ---------- Sound effects (synthesized, no audio files) ---------- */
let AC = null;
function audio(){
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; } }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
document.addEventListener("pointerdown", audio, {once:true});
function sfx(name){
  const ac = audio(); if (!ac) return Promise.resolve();
  const t0 = ac.currentTime + 0.02, out = ac.createGain(); out.gain.value = 0.22; out.connect(ac.destination);
  const n = name.toLowerCase();
  let dur = 0.3;
  if (n.includes("tap")) {
    [0, 0.13].forEach(dt => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "square"; o.frequency.setValueAtTime(1800, t0 + dt); o.frequency.exponentialRampToValueAtTime(400, t0 + dt + 0.04);
      g.gain.setValueAtTime(0.9, t0 + dt); g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.05);
      o.connect(g); g.connect(out); o.start(t0 + dt); o.stop(t0 + dt + 0.06);
    });
    dur = 0.25;
  } else if (n.includes("whir")) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 1400;
    o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(900, t0 + 0.35); o.frequency.exponentialRampToValueAtTime(420, t0 + 0.65);
    g.gain.setValueAtTime(0.001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    o.connect(f); f.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.72);
    dur = 0.72;
  } else if (n.includes("creak")) {
    const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "square"; o.frequency.value = 360; lfo.frequency.value = 23; lg.gain.value = 90;
    lfo.connect(lg); lg.connect(o.frequency); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 3;
    g.gain.setValueAtTime(0.001, t0); g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    o.connect(f); f.connect(g); g.connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + 0.52); lfo.stop(t0 + 0.52);
    dur = 0.52;
  } else if (n.includes("glug")) {
    [0, 0.18, 0.36].forEach(dt => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(160, t0 + dt); o.frequency.exponentialRampToValueAtTime(420, t0 + dt + 0.12);
      g.gain.setValueAtTime(0.001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.9, t0 + dt + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.15);
      o.connect(g); g.connect(out); o.start(t0 + dt); o.stop(t0 + dt + 0.16);
    });
    dur = 0.55;
  } else {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(880, t0); o.frequency.setValueAtTime(660, t0 + 0.1);
    g.gain.setValueAtTime(0.6, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.26);
  }
  return sleep(dur * 1000 + 60);
}
function beep(kind){
  const ac = audio(); if (!ac || !P.sfx) return;
  const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime;
  o.type = "sine";
  const f = kind === "up" ? [700, 1200] : kind === "down" ? [900, 500] : [600, 600];
  o.frequency.setValueAtTime(f[0], t0); o.frequency.exponentialRampToValueAtTime(f[1], t0 + 0.12);
  g.gain.setValueAtTime(0.18, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
  o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.17);
}

/* ---------- Eyes ---------- */
function setMood(m){
  $("#visor").dataset.mood = m;
  if (P.role === "ctl" && S.eyes.linked) linkSend({t:"mood", m});
}
function look(dir){
  $("#visor").dataset.look = dir || "";
  if (P.role === "ctl" && S.eyes.linked) linkSend({t:"look", d: dir || ""});
}
setInterval(() => {   // idle glances
  if ($("#visor").dataset.mood !== "idle" || S.listening) return;
  const r = Math.random(), v = $("#visor");
  v.dataset.look = r < .25 ? "left" : r < .5 ? "right" : r < .6 ? "up" : "";
  setTimeout(() => { if (v.dataset.mood === "idle") v.dataset.look = ""; }, 1400);
}, 4200);

/* ---------- Commands ---------- */
const NUMS = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,a:1,an:1,once:1,twice:2};
function parse(raw){
  const t = " " + raw.toLowerCase().replace(/unit\s*(7|seven)/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
  const has = (...w) => w.some(x => t.includes(" " + x + " "));
  let n = null;
  const m = t.match(/ (\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an) (step|steps|time|times) /);
  if (m) n = /\d/.test(m[1]) ? +m[1] : NUMS[m[1]];
  else if (has("once")) n = 1; else if (has("twice")) n = 2;
  if (n) n = clamp(n, 1, 10);

  if (window.playParse) { const pc = playParse(t, has); if (pc) return pc; }
  if (has("stop","halt","freeze","hold","wait","enough","stay","quit","cancel")) return {cmd:"stop"};
  if (has("jump","hop","leap","bounce")) return {cmd:"hop"};
  if (has("dance","party","boogie","groove")) return {cmd:"dance"};
  if (has("push","pushup","pushups","exercise","workout")) return {cmd:"pushups"};
  if (has("fight","guard","defend","battle","fierce")) return {cmd:"fight"};
  if (has("sleep","nap","goodnight","bedtime")) return {cmd:"sleep"};
  if (has("center","centre","calibrate","reset","straighten")) return {cmd:"center"};
  if (has("battery","power","charge")) return {cmd:"battery"};
  if (has("sidestep","side","shift","crab","strafe") || t.includes(" step left ") || t.includes(" step right "))
    return {cmd: t.includes(" right ") ? "stepright" : "stepleft", n};
  if (has("left")) return {cmd:"turnleft", n};
  if (has("right")) return {cmd:"turnright", n};
  if (has("turn","spin","rotate","around")) return {cmd:"turnleft", n};
  if (has("back","backward","backwards","reverse","retreat")) return {cmd:"backward", n};
  if (has("forward","forwards","ahead","walk","go","come","move","march","advance","here")) return {cmd:"forward", n};
  if (has("sit","lie","rest","down","crouch")) return {cmd:"sit"};
  if (has("stand","up","rise","ready")) return {cmd:"stand"};
  if (has("who","name","yourself","introduce")) return {cmd:"intro"};
  if (has("chief","voltnutt","voltnut","boss")) return {cmd:"chief"};
  if (has("thank","thanks","cheers")) return {cmd:"thanks"};
  if (has("good","great","nice","awesome","clever","well")) return {cmd:"praise"};
  if (has("wave","hello","hi")) return {cmd:"wave"};
  return null;
}

async function execute(c){
  if (!c) { beep("down"); say(pick("unknown")); return; }
  const talkOnly = ["intro","chief","thanks","praise","battery"];
  if (c.cmd === "stop") { hush(); emergencyStop(true); say(pick("stop")); return; }
  if (window.playExecute && playExecute(c)) return;
  if (talkOnly.includes(c.cmd)) {
    if (c.cmd === "battery") {
      const n = HAS ? Android.battery() : 100;
      say(pick(n < 25 ? "batteryLow" : "batteryOk", {n}));
    } else say(pick(c.cmd));
    return;
  }
  if (!S.online) { await refreshState(); if (!S.online) { say(pick("noLink")); return; } }
  if (c.cmd === "hop") return hop();
  if (["forward","backward","turnleft","turnright","stepleft","stepright"].includes(c.cmd)) {
    say(pick(c.cmd));
    look(c.cmd.includes("left") ? "left" : c.cmd.includes("right") ? "right" : c.cmd === "forward" ? "up" : "down");
    return walkSteps(ACT[c.cmd], c.n || 3, ACTION_NAMES[ACT[c.cmd]]);
  }
  if (c.cmd === "dance") { say(pick("dance")); return runAction(ACT["dance" + (1 + Math.floor(Math.random() * 3))]); }
  say(pick(c.cmd));
  if (ACT[c.cmd]) runAction(ACT[c.cmd]);
}

async function walkSteps(id, n, label){
  const tok = ++S.token; S.custom = label + " (" + n + " step" + (n > 1 ? "s" : "") + ")"; renderStatus();
  await makeRoom();
  for (let k = 1; k <= n; k++) {
    if (tok !== S.token) return;
    S.pos = null;
    await req("POST", "/api/v1/action?id=" + id);
    if (n > 1 && k > 1) say(pick("count", {n: k}));
    await sleep(300);
    if (!(await waitIdle(8000))) break;
  }
  if (tok === S.token) { S.custom = null; look(""); renderStatus(); setMood("idle"); }
}

/* ---------- Listening ---------- */
function startListen(){
  audio();
  if (!HAS) { toast("Voice works in the Android app."); return; }
  if (S.listening) { Android.stopListening(); return; }
  S.wakeListening = false;
  hush();
  S.listening = true; micUI(); setMood("listen"); beep("up");
  $("#heard").textContent = "Listening…";
  Android.listen(!!P.offline);
}
function micUI(){
  $("#micBtn").classList.toggle("listening", S.listening);
  $("#micLabel").textContent = S.listening ? "Listening… tap to finish" : "Talk to Unit 7";
}
function heard(kind, data){
  if (S.wakeListening && window.wakeHeard) { wakeHeard(kind, data); return; }
  if (kind === "ready") return;
  if (kind === "partial") { if (data && data[0]) $("#heard").textContent = "You: " + data[0]; return; }
  if (kind === "end") return;
  S.listening = false; micUI(); setMood("think");
  if (kind === "final") {
    const list = (data || []).filter(Boolean);
    $("#heard").textContent = list.length ? "You: " + list[0] : "";
    let c = null;
    for (const alt of list) { c = parse(alt); if (c) break; }
    execute(c);
    if (window.wakeResume) wakeResume();
    return;
  }
  // errors
  const code = String(data);
  setMood("idle");
  if (window.wakeResume) wakeResume();
  if (code === "7" || code === "6") { $("#heard").textContent = ""; say(pick("didntHear")); }
  else if (code === "mic-permission" || code === "9") toast("Allow microphone access for Unit 7, then try again.");
  else if (code === "no-recognizer") toast("This phone has no speech recognition service installed.");
  else if (["1","2","11","12","13"].includes(code)) toast(P.offline
    ? "Offline speech isn’t ready. Install the English offline pack, or turn off “Prefer offline” in Setup."
    : "Speech needs mobile data while you’re on the robot’s Wi-Fi.");
  else toast("Voice error " + code + ". Try again.");
}

/* ---------- Tilt ---------- */
function tiltIn(p, r, z){
  const T = S.tilt; T.p = p; T.r = r; T.z = z;
  if (!T.live) { T.live = true; T.p0 = p; T.r0 = r; }
  if (P.flipStop && z < -0.75) {
    if (!S.flipped && (S.driving || S.custom || S.legTilt || robotBusy())) {
      S.flipped = true; hush(); emergencyStop(true); say(pick("flipStop"));
      if (HAS) Android.vibrate(200);
    }
  } else if (z > -0.3) S.flipped = false;
  drawGauge();
  if (S.legTilt) legTiltTick();
}
function tiltVec(){
  const T = S.tilt;
  let fwd = T.p - T.p0, left = T.r - T.r0;
  if (P.invF) fwd = -fwd;
  if (P.invT) left = -left;
  return {fwd, left};
}
function tiltDir(){
  const {fwd, left} = tiltVec(), dz = 8, full = 30;
  const af = Math.abs(fwd), al = Math.abs(left);
  if (af < dz && al < dz) return null;
  if (af >= al) return {dir: fwd > 0 ? "forward" : "backward", mag: clamp((af - dz) / (full - dz), 0, 1)};
  return {dir: left > 0 ? "turnleft" : "turnright", mag: clamp((al - dz) / (full - dz), 0, 1)};
}
function drawGauge(){
  if (S.tab !== "pilot") return;
  const {fwd, left} = tiltVec();
  const x = 100 - clamp(left, -35, 35) / 35 * 78, y = 100 - clamp(fwd, -35, 35) / 35 * 78;
  const dot = $("#gDot"); dot.setAttribute("cx", x.toFixed(1)); dot.setAttribute("cy", y.toFixed(1));
  const d = tiltDir();
  dot.classList.toggle("go", !!(d && S.driving));
  const names = {forward:"Forward", backward:"Back", turnleft:"Turn left", turnright:"Turn right"};
  $("#gText").textContent = !S.tilt.live ? "Tilt sensor starting…" :
    d ? names[d.dir] + (P.walk === "high" ? " · speed " + Math.round(30 + 70 * d.mag) + "%" : "") + (S.driving ? "" : " (hold drive to go)")
      : "Level";
}

/* ---------- Pilot driving ---------- */
function highStepFrame(fr){
  return fr.map((v,i) => isLift(i) ? liftA(i, liftU(i,v) > 5 ? 38 : -8) : v);
}
async function driveLoop(){
  const tok = ++S.token; S.driving = true; S.custom = null;
  S.tilt.p0 = S.tilt.p; S.tilt.r0 = S.tilt.r;
  setMood("busy");
  if (P.walk === "builtin") {
    let lastDir = null;
    while (S.driving && tok === S.token) {
      const d = tiltDir(); drawGauge();
      if (!d) { lastDir = null; look(""); await sleep(100); continue; }
      look(d.dir === "turnleft" ? "left" : d.dir === "turnright" ? "right" : d.dir === "forward" ? "up" : "down");
      const s = await refreshState();
      if (tok !== S.token || !S.driving) break;
      if (!(s && (s.busy || s.requested_action_id))) {
        S.pos = null;
        await req("POST", "/api/v1/action?id=" + ACT[d.dir]);
        lastDir = d.dir;
        $("#statusLine").textContent = ACTION_NAMES[ACT[d.dir]];
        await sleep(250);
      } else await sleep(150);
    }
  } else {
    await makeRoom();
    while (S.driving && tok === S.token) {
      const d = tiltDir(); drawGauge();
      if (!d) { look(""); await applyPose(highStepFrame(STAND), tok); await sleep(100); continue; }
      $("#statusLine").textContent = "High-stepping";
      for (const fr of GAIT[d.dir]) {
        if (!S.driving || tok !== S.token) break;
        const dd = tiltDir(); if (!dd || dd.dir !== d.dir) break;
        const ms = Math.round(440 - 260 * dd.mag), t0 = Date.now();
        await applyPose(highStepFrame(fr), tok);
        const rest = ms - (Date.now() - t0); if (rest > 0) await sleep(rest);
      }
    }
    if (tok === S.token) await applyPose(STAND, tok);
  }
  look(""); drawGauge(); renderStatus();
  if (tok === S.token && !S.listening) setMood("idle");
}
function endDrive(){
  if (!S.driving) return;
  S.driving = false;
  $("#driveBtn").classList.remove("held");
  if (P.walk === "builtin") req("POST", "/api/v1/stop");
}

/* ---------- Legs ---------- */
const curPose = () => (S.pos || STAND).slice();
function drawSpider(){
  const p = curPose();
  let g = "";
  for (const key of Object.keys(LEGS)) {
    const L = LEGS[key];
    const u = liftU(L.lift, p[L.lift]);
    const ang = (L.dir + L.flip * (p[L.swing] - 90)) * Math.PI / 180;
    const len = u > 8 ? 62 : 78;
    const x = L.hip[0] + Math.cos(ang) * len, y = L.hip[1] + Math.sin(ang) * len;
    g += '<g class="' + (key === S.leg ? "sel" : "") + '" data-leg="' + key + '">' +
      '<line class="leg" x1="' + L.hip[0] + '" y1="' + L.hip[1] + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
      '<circle class="foot' + (u > 8 ? " up" : "") + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (u > 8 ? 13 : 9) + '"/>' +
      '<circle class="hit" cx="' + ((L.hip[0] + x) / 2).toFixed(1) + '" cy="' + ((L.hip[1] + y) / 2).toFixed(1) + '" r="44"/></g>';
  }
  $("#legsLayer").innerHTML = g;
}
const fmtLift = u => u === 0 ? "Planted" : (u > 0 ? "+" : "") + u + "°";
const fmtSwing = a => a === 90 ? "Center" : (a > 90 ? "+" : "") + (a - 90) + "°";
function syncLegUI(){
  const L = LEGS[S.leg], p = want || curPose();
  $("#legName").textContent = L.name;
  $("#legLift").value = Math.round(liftU(L.lift, p[L.lift]));
  $("#legSwing").value = p[L.swing];
  $("#legLiftOut").textContent = fmtLift(+$("#legLift").value);
  $("#legSwingOut").textContent = fmtSwing(+$("#legSwing").value);
  drawSpider();
}
function legPose(key, lift, swing){
  const p = (want || curPose()).slice(), L = LEGS[key];
  p[L.lift] = liftA(L.lift, lift);
  p[L.swing] = swing;
  if (P.balance) {
    const opp = OPPOSITE[key], O = LEGS[opp];
    if (lift > 8) { p[O.lift] = liftA(O.lift, -14); S.balanced = opp; }
    else if (S.balanced === opp) { p[O.lift] = liftA(O.lift, 0); S.balanced = null; }
  }
  return p;
}
let want = null, pumping = false, legTok = -1, legSaid = false;
async function wantPose(p){
  want = p;
  if (pumping) return;
  pumping = true;
  if (legTok !== S.token) { legTok = ++S.token; S.custom = "Moving legs"; renderStatus(); await makeRoom(); }
  while (want && legTok === S.token) {
    const w = want;
    if (S.pos && w.every((v,i) => Math.round(clampA(i,v)) === S.pos[i])) break;
    await applyPose(w, legTok);
    drawSpider();
  }
  want = null; pumping = false;
  if (legTok === S.token && !S.legTilt) { S.custom = null; renderStatus(); }
}
function sendLegFromSliders(){
  const lift = +$("#legLift").value, swing = +$("#legSwing").value;
  $("#legLiftOut").textContent = fmtLift(lift);
  $("#legSwingOut").textContent = fmtSwing(swing);
  if (lift > 8 && !legSaid) { legSaid = true; say(pick("legLift")); }
  if (lift <= 8) legSaid = false;
  const p = legPose(S.leg, lift, swing);
  want = p; drawSpiderFrom(p);
  wantPose(p);
}
function drawSpiderFrom(p){ const keep = S.pos; S.pos = p; drawSpider(); S.pos = keep; }
let legTiltLast = null;
function legTiltTick(){
  const {fwd, left} = tiltVec();
  const lift = Math.round(clamp(fwd * 1.6, -25, 55));
  const swing = Math.round(clamp(90 - left * 1.6, 40, 140));
  if (legTiltLast && Math.abs(legTiltLast[0] - lift) < 3 && Math.abs(legTiltLast[1] - swing) < 3) return;
  legTiltLast = [lift, swing];
  $("#legLift").value = lift; $("#legSwing").value = swing;
  sendLegFromSliders();
}

/* ---------- Hop ---------- */
async function hop(){
  if (Date.now() - S.lastHop < 5000) { say(pick("hopCooldown")); return; }
  S.lastHop = Date.now();
  const tok = ++S.token; S.custom = "Hopping"; renderStatus();
  await makeRoom(); if (tok !== S.token) return;
  say(pick("hopStart"));
  await applyPose(STAND, tok, true); await sleep(250);
  // Lighter hop when the Eyes phone is riding on top.
  const crouch = STAND.map((v,i) => isLift(i) ? liftA(i, S.eyes.linked ? 24 : 32) : v);
  await applyPose(crouch, tok, true); await sleep(650);
  if (tok !== S.token) return;
  const spring = STAND.map((v,i) => isLift(i) ? liftA(i, -25) : v);
  await applyPose(spring, tok, true); await sleep(280);
  if (tok !== S.token) return;
  await applyPose(STAND, tok, true);
  S.custom = null; renderStatus(); drawSpider();
  say(pick("hopLand"));
}

/* ---------- UI wiring ---------- */
let toastTimer;
function toast(msg){
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function showTab(name){
  S.tab = name;
  $$(".tab").forEach(t => t.classList.toggle("active", t.id === "tab-" + name));
  $$("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  const needTilt = name === "pilot" || name === "legs";
  if (HAS) Android.tilt(needTilt);
  if (needTilt) { S.tilt.p0 = S.tilt.p; S.tilt.r0 = S.tilt.r; }
  if (name === "legs") syncLegUI();
  if (name === "pilot") drawGauge();
}
$$("nav button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
$("#stopBtn").addEventListener("click", () => { hush(); emergencyStop(false); if (HAS) Android.vibrate(60); });
$("#micBtn").addEventListener("click", startListen);
$$("[data-say]").forEach(b => b.addEventListener("click", () => { audio(); execute({cmd: b.dataset.say}); }));

function holdButton(el, onDown, onUp){
  el.addEventListener("pointerdown", e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("held"); onDown(); });
  const up = () => { if (el.classList.contains("held")) { el.classList.remove("held"); onUp(); } };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
  el.addEventListener("contextmenu", e => e.preventDefault());
}
holdButton($("#driveBtn"), () => {
  audio();
  if (!S.online) { toast("Not connected. Join the robot’s Wi-Fi."); }
  if (HAS) Android.vibrate(20);
  driveLoop();
}, endDrive);
holdButton($("#legTiltBtn"), () => {
  audio(); S.legTilt = true; legTiltLast = null;
  S.tilt.p0 = S.tilt.p; S.tilt.r0 = S.tilt.r;
  if (HAS) Android.vibrate(20);
}, () => { S.legTilt = false; if (!pumping) { S.custom = null; renderStatus(); } });

$("#legsLayer").addEventListener("click", e => {
  const g = e.target.closest("[data-leg]");
  if (g) { S.leg = g.dataset.leg; syncLegUI(); }
});
$("#legLift").addEventListener("input", sendLegFromSliders);
$("#legSwing").addEventListener("input", sendLegFromSliders);
$("#standBtn").addEventListener("click", () => { legSaid = false; S.balanced = null; want = STAND.slice(); drawSpiderFrom(want); wantPose(want).then(syncLegUI); say(pick("stand")); });
$("#hopBtn").addEventListener("click", () => { audio(); hop(); });

function renderWalk(){
  $$("[data-walk]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.walk === P.walk)));
  $("#walkNote").textContent = P.walk === "builtin"
    ? "Smooth walking using the robot’s own steps. Tilt sets the direction."
    : "Lifts feet higher to clear pebbles. Tilt further to walk faster.";
}
$$("[data-walk]").forEach(b => b.addEventListener("click", () => { P.walk = b.dataset.walk; savePrefs(); renderWalk(); }));

function bindToggle(id, key){
  const el = $("#" + id); el.checked = !!P[key];
  el.addEventListener("change", () => { P[key] = el.checked; savePrefs(); drawGauge(); });
}
bindToggle("balance","balance"); bindToggle("pTalk","talk"); bindToggle("pSfx","sfx");
bindToggle("pOffline","offline"); bindToggle("pFlip","flipStop"); bindToggle("pInvF","invF"); bindToggle("pInvT","invT");
$("#addr").value = P.base;
$("#addr").addEventListener("change", () => { P.base = $("#addr").value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") || DEFAULTS.base; $("#addr").value = P.base; savePrefs(); refreshState(); });
$("#testBtn").addEventListener("click", async () => {
  const r = await req("GET", "/api/v1/info");
  toast(r.status ? "Connected to " + ((r.json && r.json.data && r.json.data.device_name) || "the robot") + "." : "No answer from " + P.base + ". Check you’re on the robot’s Wi-Fi.");
});

/* ---------- Two-phone link ---------- */
function linkSend(o){
  if (!HAS) return;
  o.from = MY_ID; o.role = P.role;
  const to = P.role === "ctl" ? (P.eyesAddr || S.eyes.ip || "") : (o.to || "");
  delete o.to;
  Android.linkSend(JSON.stringify(o), to);
}
const saidWait = {};
let remoteId = 0;
async function remoteSay({mood, text}, tok){
  $("#visor").dataset.mood = mood;
  $("#says").innerHTML = text.replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))
    .replace(/\[(.+?)\]/g, '<span class="tic">[$1]</span>');
  const id = MY_ID + "-" + (++remoteId);
  linkSend({t:"say", id, mood, text, talk:P.talk, sfx:P.sfx});
  await new Promise(res => {
    const t = setTimeout(() => { delete saidWait[id]; res(); }, Math.max(3500, text.length * 110));
    saidWait[id] = () => { clearTimeout(t); res(); };
  });
  if (tok === sayTok && !S.listening) setMood(restMood());
}
function linkIn(raw, from){
  let m; try { m = JSON.parse(raw); } catch(e) { return; }
  if (!m || m.from === MY_ID) return;
  if (P.role === "ctl") {
    if (m.role !== "eyes") return;
    if (m.t === "hb") {
      const wasLinked = S.eyes.linked;
      S.eyes.ip = from; S.eyes.bat = m.bat; S.eyes.last = Date.now(); S.eyes.linked = true;
      renderEyesLink();
      if (!wasLinked) { linkSend({t:"color", c: P.color}); say(pick("eyesLinked")); }
      if (m.bat != null && m.bat < 20 && !S.eyes.warned) { S.eyes.warned = true; say(pick("eyesBatteryLow", {n: m.bat})); }
      if (m.bat != null && m.bat > 30) S.eyes.warned = false;
    } else if (m.t === "said" && saidWait[m.id]) { const f = saidWait[m.id]; delete saidWait[m.id]; f(); }
    else if (m.t === "card") doCard(String(m.c));
    else if (window.playLink) playLink(m);
    return;
  }
  // Eyes phone
  if (m.role !== "ctl") return;
  S.ctlLast = Date.now(); S.ctlIp = from;
  wake();
  if (m.t === "say") {
    const talk = P.talk, fx = P.sfx;
    P.talk = m.talk !== false; P.sfx = m.sfx !== false;
    const tok = sayTok;
    sayChain = sayChain.then(() => tok === sayTok ? doSay({mood: m.mood, text: m.text}, tok) : null).catch(() => {})
      .then(() => { P.talk = talk; P.sfx = fx; linkSend({t:"said", id: m.id, to: from}); });
  } else if (m.t === "mood") $("#visor").dataset.mood = m.m;
  else if (m.t === "look") $("#visor").dataset.look = m.d;
  else if (m.t === "hush") hush();
  else if (m.t === "color") { if (!m.temp) { P.color = m.c; savePrefs(); } applyColor(m.c); }
  else if (window.senseLink) senseLink(m);
}
function renderEyesLink(){
  const on = S.eyes.linked;
  $("#eyesTag").classList.toggle("on", on);
  $("#eyesTag").setAttribute("aria-label", on ? "Eyes phone linked" : "Eyes phone not linked");
  $("#eyesStatus").textContent = on
    ? "Linked to the Eyes phone at " + S.eyes.ip + (S.eyes.bat != null ? " (battery " + S.eyes.bat + "%)." : ".")
    : "No Eyes phone found yet. Open Unit 7 on the robot’s phone, choose Eyes, and join the same Wi-Fi.";
}

/* ---------- Eyes mode: dim when idle, sleep without a controller ---------- */
let dimTimer = null, dimmed = false;
function wake(){
  if (!isEyes()) return;
  if (dimmed && HAS) Android.brightness(-1);
  dimmed = false;
  if ($("#visor").dataset.mood === "sleep" && S.ctlAsleep) { $("#visor").dataset.mood = "happy"; setTimeout(() => { if ($("#visor").dataset.mood === "happy") $("#visor").dataset.mood = "idle"; }, 1200); }
  S.ctlAsleep = false;
  clearTimeout(dimTimer);
  dimTimer = setTimeout(() => { dimmed = true; if (HAS) Android.brightness(0.15); }, 60000);
}
function startEyes(){
  document.body.classList.add("eyes-mode");
  if (HAS) { Android.eyesMode(true); Android.linkStart(); }
  $("#visor").dataset.mood = "sleep"; S.ctlAsleep = true;
  startScanner();
  if (window.startEars) startEars();
  setTimeout(() => $("#eyesHint").classList.add("gone"), 5000);
  setInterval(() => {
    linkSend({t:"hb", bat: HAS ? Android.battery() : null});
    if (Date.now() - S.ctlLast > 10000 && !S.ctlAsleep) { S.ctlAsleep = true; $("#visor").dataset.mood = "sleep"; }
  }, 2000);
  // Hold anywhere for 3 seconds to leave.
  let holdT = null;
  document.addEventListener("pointerdown", () => { holdT = setTimeout(leaveEyes, 3000); });
  ["pointerup","pointercancel"].forEach(ev => document.addEventListener(ev, () => clearTimeout(holdT)));
}
function leaveEyes(){
  P.role = null; savePrefs();
  if (HAS) Android.eyesMode(false);
  location.reload();
}
function startController(){
  if (HAS) Android.linkStart();
  setInterval(() => {
    linkSend({t:"hb"});
    if (S.eyes.linked && Date.now() - S.eyes.last > 7000) {
      S.eyes.linked = false; renderEyesLink(); toast("Lost the Eyes phone. Unit 7 will speak from this phone.");
    }
  }, 2000);
  renderEyesLink();
  (async () => {
    await refreshState();
    booted = true;
    say(pick(!S.online ? "bootNoRobot" : window.bootKey ? bootKey() : "boot"));
  })();
}
$("#eyesAddr").value = P.eyesAddr;
$("#eyesAddr").addEventListener("change", () => { P.eyesAddr = $("#eyesAddr").value.trim(); savePrefs(); });
$("#roleBtn").addEventListener("click", () => { P.role = "eyes"; savePrefs(); location.reload(); });
$$("[data-role]").forEach(b => b.addEventListener("click", () => {
  audio(); P.role = b.dataset.role; savePrefs();
  $("#roleScreen").hidden = true;
  P.role === "eyes" ? startEyes() : startController();
}));

/* ---------- Lens colours ---------- */
const COLORS = {
  amber:  ["#ffe08a","#ffb21c","#b86a00","255,178,28"],
  red:    ["#ffb3a3","#ff3b24","#9e1500","255,59,36"],
  blue:   ["#bfe6ff","#2fa8ff","#0b4f9e","47,168,255"],
  green:  ["#c8ffcf","#3ddc6a","#137a33","61,220,106"],
  purple: ["#e8c9ff","#b25cff","#5b1d9e","178,92,255"],
  white:  ["#ffffff","#dfe9f0","#8fa1ad","223,233,240"],
  gold:   ["#fff3b0","#ffd23f","#a07800","255,210,63"]
};
function applyColor(name){
  const c = COLORS[name] || COLORS.amber, v = $("#visor").style;
  v.setProperty("--i1", c[0]); v.setProperty("--i2", c[1]); v.setProperty("--i3", c[2]);
  v.setProperty("--glow", "rgba(" + c[3] + ",.55)"); v.setProperty("--glow2", "rgba(" + c[3] + ",.95)");
  $$("#swatches button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.color === name)));
}
function setColor(name){
  if (!COLORS[name]) return;
  P.color = name; savePrefs(); applyColor(name);
  if (P.role === "ctl" && S.eyes.linked) linkSend({t:"color", c:name});
}
function renderSwatches(){
$("#swatches").innerHTML = Object.keys(COLORS).filter(k => k !== "gold" || (window.goldUnlocked && goldUnlocked())).map(k =>
  '<button data-color="' + k + '" aria-label="' + k + '" style="background:' + COLORS[k][1] + '"></button>').join("");
$$("#swatches button").forEach(b => b.addEventListener("click", () => setColor(b.dataset.color)));
applyColor(P.color);
}

/* ---------- QR cards ---------- */
// Card text: "UNIT7:<NAME>" or "UNIT7:COLOR:<colour>"
function holdMood(m, ms){ S.hold = {m, until: Date.now() + ms}; setMood(m); }
async function wiggle(ids){
  const tok = ++S.token; S.custom = "Card move"; renderStatus();
  await makeRoom();
  for (const id of ids) {
    if (tok !== S.token) return;
    S.pos = null; await req("POST", "/api/v1/action?id=" + id); await sleep(300);
    if (!(await waitIdle(8000))) break;
  }
  if (tok === S.token) { S.custom = null; renderStatus(); }
}
const CARDS = {
  PARTY:   {mood:"party",   line:"cardParty",   ms:9000, move: () => runAction(ACT["dance" + (1 + Math.floor(Math.random() * 3))])},
  OIL:     {mood:"happy",   line:"cardOil",     ms:5000, move: () => walkSteps(ACT.forward, 2, "Walking to the oil can")},
  SLEEP:   {mood:"sleep",   line:"sleep",       ms:15000, move: () => runAction(ACT.sleep)},
  WAKE:    {mood:"happy",   line:"cardWake",    ms:3000, move: () => runAction(ACT.stand)},
  HELLO:   {mood:"happy",   line:"cardHello",   ms:3000},
  JUMP:    {jump:true},
  HAPPY:   {mood:"happy",   line:"cardHappy",   ms:6000, move: () => wiggle([ACT.stepleft, ACT.stepright])},
  SCARED:  {mood:"worried", line:"cardScared",  ms:6000, move: () => walkSteps(ACT.backward, 2, "Backing away")},
  FIERCE:  {mood:"angry",   line:"cardFierce",  ms:6000, move: () => runAction(ACT.fight)},
  SAD:     {mood:"sad",     line:"cardSad",     ms:8000, move: () => runAction(ACT.sit)},
  CURIOUS: {mood:"think",   line:"cardCurious", ms:6000, move: () => wiggle([ACT.turnleft, ACT.turnright])},
  CHIEF:   {mood:"happy",   line:"cardChief",   ms:4000, move: () => runAction(ACT.stand)}
};
async function doCard(code){
  if (window.playCard && playCard(code)) return;
  const parts = code.split(":");
  if (parts[0] !== "UNIT7") { say(pick("cardUnknown")); return; }
  if (parts[1] === "COLOR") {
    const c = (parts[2] || "").toLowerCase();
    if (!COLORS[c]) { say(pick("cardUnknown")); return; }
    setColor(c);
    say(pick(c === "amber" ? "cardAmber" : "cardColor", {c}));
    return;
  }
  const card = CARDS[parts[1]];
  if (!card) { say(pick("cardUnknown")); return; }
  if (card.jump) { if (S.online) hop(); else say(pick("hopStart")); return; }
  hush();
  S.hold = {m: card.mood, until: Date.now() + card.ms};
  say(pick(card.line));
  if (P.role === "ctl" && S.online && card.move) card.move();
}
// Eyes phone: watch through the front camera for cards.
const scan = {last:"", lastAt:0, busy:false, flip:false, on:false};
async function startScanner(){
  if (!navigator.mediaDevices || !window.jsQR) return;
  if (HAS && !Android.hasCamera()) {
    const ok = await new Promise(res => { U7.onCameraPermission = res; Android.askCamera(); });
    if (!ok) return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "user", width: {ideal: 640}, height: {ideal: 480}}, audio: false});
  } catch(e) { console.log("camera error", e); return; }
  const v = $("#cam"); v.srcObject = stream; await v.play().catch(() => {});
  scan.on = true;
  const cv = $("#scan"), ctx = cv.getContext("2d", {willReadFrequently: true});
  let tick = 0;
  setInterval(() => {
    if (!v.videoWidth || scan.busy) return;
    if (window.senseFrame) senseFrame(v);
    if ((++tick) % 2) return;
    const w = 400, h = Math.round(w * v.videoHeight / v.videoWidth);
    cv.width = w; cv.height = h;
    scan.flip = !scan.flip;   // try both ways in case the camera mirrors
    ctx.setTransform(scan.flip ? -1 : 1, 0, 0, 1, scan.flip ? w : 0, 0);
    ctx.drawImage(v, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const r = jsQR(img.data, w, h, {inversionAttempts: "dontInvert"});
    if (r && r.data) cardSeen(r.data.trim());
  }, 250);
}
function cardSeen(code){
  const now = Date.now();
  const game = window.SENSE && SENSE.game;
  if (code === scan.last && now - scan.lastAt < (game ? 2500 : 6000)) return;
  if (now - scan.lastAt < (game ? 1000 : 2000)) return;
  scan.last = code; scan.lastAt = now;
  wake(); beep("up");
  $("#visor").dataset.mood = "seen";
  setTimeout(() => { if ($("#visor").dataset.mood === "seen") $("#visor").dataset.mood = "idle"; }, 3000);
  if (!S.ctlAsleep && S.ctlIp) linkSend({t:"card", c: code, to: S.ctlIp});
  else setTimeout(() => doCard(code), 250);   // no controller: eyes and voice only
}

/* ---------- Start ---------- */
let booted = false;
window.addEventListener("load", () => { renderSwatches(); if (window.playInit) playInit(); });
renderWalk(); drawSpider(); renderStatus();
if (P.role === "eyes") startEyes();
else if (P.role === "ctl") startController();
else $("#roleScreen").hidden = false;
