"use strict";
/* Explore mode (controller phone): for a new place. Unit 7 wanders using the robot's own
   obstacle-avoid walk, watches for faces through the Palm, and when he meets someone new he
   asks their name, asks before remembering their face, checks whether they're scared of him,
   and tells a joke to put them at ease. */

const EXP = {on: false, talking: false, await: null, cand: null, greeted: {}, lastMeet: 0, roamAt: 0};
const PEOPLE_KEY = "u7.people";
const loadPeople = () => { try { return JSON.parse(localStorage.getItem(PEOPLE_KEY)) || []; } catch(e) { return []; } };
const savePeople = p => { try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(p)); } catch(e) {} };
let PEOPLE = loadPeople();

Object.assign(LINES, {
  exploreOn: [["happy", "[Gyro whir] New place detected! Exploration protocol engaged. I'll look around and say hello to anyone I meet."]],
  exploreStill: [["think", "Exploration mode, but my legs aren't linked. I'll stay here and watch for new faces."]],
  exploreOff: [["happy", "Exploration complete. Excellent place. Very explorable."]],
  meetHello: [["surprised", "Oh! Hello there. I'm Unit 7, a maintenance crawler. I don't think we've met. What's your name?"]],
  meetHelloAgain: [["think", "Sorry, I didn't catch that. What's your name?"]],
  meetNoName: [["happy", "That's alright. Names are optional. Smiles are not."]],
  meetNice: [["happy", "[Leg tap] Nice to meet you, {who}!"]],
  meetAskRemember: [["listen", "Is it okay if I remember your face, so I can say hello next time?"]],
  meetRemember: [["happy", "Thank you, {who}. Saved to my memory banks. It stays on our phones, I promise."]],
  meetForget: [["happy", "No problem. I won't remember your face."]],
  meetAskScared: [["listen", "Can I ask you something, {who}? Are you scared of me? Some people don't like spider robots, and that's okay."]],
  meetScaredYes: [["worried", "That's okay. I'm only knee-high and I mostly check bolts. Here's a joke, to show I'm friendly."]],
  meetScaredNo: [["happy", "Brilliant! Then you get a joke anyway."]],
  meetScaredMaybe: [["think", "I'll take that as a maybe. A joke usually helps."]],
  meetAfterJoke: [["happy", "I hope that helped. I'll keep exploring now. Shout if you need a bolt checked!"]],
  greetKnown: [["happy", "[Leg tap] Hello again, {who}! Good to see you."], ["happy", "{who}! I remember you. Hello!"]],
  peopleForgotten: [["think", "Done. I've forgotten everyone's face. Fresh start."]]
});

/* ---------- Matching faces ---------- */
const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function whoIs(emb){
  let best = null, score = 0;
  for (const p of PEOPLE) for (const e of p.embs) { const c = cosine(emb, e); if (c > score) { score = c; best = p; } }
  return score > 0.6 ? {person: best, score} : {person: null, score};
}

/* ---------- Roaming ---------- */
async function roamGo(){
  if (!EXP.on || EXP.talking || !S.online) return;
  S.custom = "Exploring"; renderStatus();
  EXP.roamAt = Date.now();
  await req("POST", "/api/v1/action?id=21");   // the robot's own obstacle-avoid walk
}
async function roamPause(label){
  S.token++;
  S.custom = label || "Meeting someone"; renderStatus();
  if (S.online) { await req("POST", "/api/v1/stop"); await waitIdle(2500); }
}
setInterval(async () => {   // keep wandering, and keep him awake, while exploring
  if (!EXP.on) return;
  if (window.userActive) userActive(true);
  if (EXP.talking || !S.online) return;
  const s = await refreshState();
  if (EXP.on && !EXP.talking && s && !s.busy && !s.requested_action_id && Date.now() - EXP.roamAt > 4000) roamGo();
}, 5000);

async function exploreStart(){
  if (EXP.on) return;
  if (!S.eyes.linked || S.eyes.kind === "head") { say(pick("needEyes")); return; }
  hush();
  EXP.on = true; EXP.cand = null;
  linkSend({t: "explore", on: true});
  renderExplore();
  if (!S.online) await refreshState();
  say(pick(S.online ? "exploreOn" : "exploreStill"));
  await sayChain;
  if (S.online) { await makeRoom(); roamGo(); }
}
function exploreStop(silent){
  if (!EXP.on) return;
  EXP.on = false; EXP.talking = false;
  if (EXP.await) { EXP.await(null); EXP.await = null; }
  linkSend({t: "explore", on: false});
  if (S.custom === "Exploring" || S.custom === "Meeting someone") { S.custom = null; renderStatus(); }
  if (S.online) req("POST", "/api/v1/stop");
  renderExplore();
  if (!silent) say(pick("exploreOff"));
}

/* ---------- Talking with the person in front of the Palm ---------- */
function listenOnEyes(ms){
  return new Promise(res => {
    const t = setTimeout(() => { EXP.await = null; res(null); }, ms);
    EXP.await = list => { clearTimeout(t); EXP.await = null; res(list); };
    linkSend({t: "listen"});
  });
}
async function ask(lineKey, vars, ms){
  say(pick(lineKey, vars)); await sayChain;
  if (!EXP.on) return null;
  const list = await listenOnEyes(ms || 9000);
  return list && list.length ? " " + String(list[0]).toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim() + " " : null;
}
const NOT_NAMES = /^(yes|no|yeah|nope|hello|hi|hey|ok|okay|um|uh|what|i|me|my|the|a|unit|robot|sorry|maybe|sure)$/;
function nameFrom(t){
  const m = t.match(/(?:my name is|call me|i am|i'm|it's|its|name's|this is)\s+([a-z][a-z'-]*)/) ||
            t.trim().replace(/^(hi|hello|hey)\s+/, "").match(/^([a-z][a-z'-]*)(\s|$)/);
  if (!m || NOT_NAMES.test(m[1])) return null;
  return m[1][0].toUpperCase() + m[1].slice(1);
}
const saidYes = t => /\b(yes|yeah|yep|sure|okay|ok|of course|go ahead|fine|a bit|little|kind of|kinda)\b/.test(t);
const saidNo = t => /\b(no|nope|not|never|don't|dont|nah)\b/.test(t);
const saidHi = t => /\b(hi|hello)\b/.test(t);

async function meet(emb){
  EXP.talking = true; EXP.lastMeet = Date.now();
  await roamPause("Meeting someone");
  hush();
  S.hold = {m: "happy", until: Date.now() + 120000};
  let name = null, heardHi = false;
  for (let i = 0; i < 2 && !name && EXP.on; i++) {
    const t = await ask(i ? "meetHelloAgain" : "meetHello", {}, 9000);
    if (!t) continue;
    if (saidHi(t)) heardHi = true;
    name = nameFrom(t);
  }
  if (!EXP.on) return;
  if (heardHi && S.online) runAction(ACT.wave);   // he waves only when greeted with hello or hi
  if (name) {
    say(pick("meetNice", {who: name}));
    const ok = await ask("meetAskRemember", {}, 8000);
    if (ok && saidYes(ok) && !saidNo(ok) && emb) {
      PEOPLE = PEOPLE.filter(p => p.name.toLowerCase() !== name.toLowerCase());
      PEOPLE.push({name, embs: [emb], met: Date.now()});
      savePeople(PEOPLE); renderPeople();
      EXP.greeted[name] = Date.now();
      say(pick("meetRemember", {who: name}));
    } else say(pick("meetForget"));
  } else say(pick("meetNoName"));
  if (!EXP.on) return;
  const who = name || "friend";
  const sc = await ask("meetAskScared", {who}, 8000);
  if (!EXP.on) return;
  if (sc && saidYes(sc) && !/\bnot\b/.test(sc)) { S.hold = {m: "worried", until: Date.now() + 4000}; say(pick("meetScaredYes")); if (S.online) runAction(ACT.sit); }
  else if (sc && saidNo(sc)) say(pick("meetScaredNo"));
  else say(pick("meetScaredMaybe"));
  const j = LINES.jokes[Math.floor(Math.random() * LINES.jokes.length)];
  S.hold = {m: "happy", until: Date.now() + 8000};
  say({mood: j[0], text: j[1]});
  say(pick("meetAfterJoke"));
  await sayChain;
  if (window.grow) grow("curious", 2);
  if (typeof SES !== "undefined") SES.events.push(name ? "met " + name : "met someone new");
  EXP.talking = false; S.hold = null;
  if (S.custom === "Meeting someone") { S.custom = null; renderStatus(); }
  setTimeout(roamGo, 3000);
}

function onFaces(faces){
  if (!EXP.on || EXP.talking || !faces.length) return;
  const f = faces[0];
  if (f.w < 0.14 || !f.emb) { EXP.cand = null; return; }   // too far away
  const {person} = whoIs(f.emb);
  if (person) {
    EXP.cand = null;
    if (Date.now() - (EXP.greeted[person.name] || 0) < 10 * 60000) return;
    EXP.greeted[person.name] = Date.now();
    if (person.embs.length < 5) { person.embs.push(f.emb); savePeople(PEOPLE); }   // learn a little more each time
    (async () => {
      EXP.talking = true;
      await roamPause("Saying hello");
      say(pick("greetKnown", {who: person.name})); await sayChain;
      EXP.talking = false;
      if (S.custom === "Saying hello") { S.custom = null; renderStatus(); }
      setTimeout(roamGo, 2000);
    })();
    return;
  }
  // Someone new: make sure it's the same face twice in a row before stopping to talk.
  if (EXP.cand && cosine(EXP.cand, f.emb) > 0.6 && Date.now() - EXP.lastMeet > 45000) { EXP.cand = null; meet(f.emb); }
  else EXP.cand = f.emb;
}

/* ---------- Hooks ---------- */
const prevPlayLinkE = playLink;
playLink = function(m){
  if (m.t === "faces") { onFaces(m.faces || []); return; }
  if (m.t === "heard" && EXP.await) {
    const list = m.list || [];
    if (list.some(x => /\b(stop|halt|freeze)\b/i.test(x))) { EXP.await(null); exploreStop(false); return; }
    $("#heard").textContent = list.length ? "Heard by Unit 7: " + list[0] : "";
    EXP.await(list); return;
  }
  prevPlayLinkE(m);
};
const prevPlayStop = playStop;
playStop = function(){ prevPlayStop(); if (EXP.on) exploreStop(true); };
const prevPersonaParse = personaParse;
personaParse = function(t, has, raw){
  if (has("explore","exploring") || t.includes(" new place ") || t.includes(" look around ")) {
    return has("stop","end","finish","quit") ? {cmd: "exploreoff"} : {cmd: "exploreon"};
  }
  if (t.includes(" forget everyone ") || t.includes(" forget all faces ")) return {cmd: "forgetpeople"};
  return prevPersonaParse(t, has, raw);
};
const prevPersonaExecute = personaExecute;
personaExecute = function(c){
  if (c.cmd === "exploreon") { exploreStart(); return true; }
  if (c.cmd === "exploreoff") { exploreStop(false); return true; }
  if (c.cmd === "forgetpeople") { PEOPLE = []; savePeople(PEOPLE); renderPeople(); say(pick("peopleForgotten")); return true; }
  return prevPersonaExecute(c);
};

/* ---------- UI ---------- */
function renderExplore(){
  const b = $("#exploreBtn");
  b.setAttribute("aria-checked", String(EXP.on));
  $("#exploreState").textContent = EXP.on ? "On: wandering and watching for new faces" : "Off";
}
function renderPeople(){
  const el = $("#peopleList");
  el.innerHTML = PEOPLE.length
    ? PEOPLE.map((p, i) => '<div class="person"><span>' + p.name.replace(/[<>&]/g, "") + '</span><button data-forget="' + i + '">Forget</button></div>').join("")
    : '<p class="note">Nobody yet. In Explore mode he asks new people their name and whether he may remember them.</p>';
}
window.addEventListener("load", () => {
  if (P.role !== "ctl") return;
  renderExplore(); renderPeople();
  $("#exploreBtn").addEventListener("click", () => { audio(); EXP.on ? exploreStop(false) : exploreStart(); });
  $("#peopleList").addEventListener("click", e => {
    const b = e.target.closest("[data-forget]"); if (!b) return;
    PEOPLE.splice(+b.dataset.forget, 1); savePeople(PEOPLE); renderPeople();
  });
  $("#forgetAll").addEventListener("click", () => { PEOPLE = []; savePeople(PEOPLE); renderPeople(); toast("Unit 7 has forgotten every face."); });
});
