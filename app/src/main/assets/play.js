"use strict";
/* Controller phone: encourage points and ranks, gesture reactions, follow-the-light,
   the four games, and hands-free "Hey Unit 7". */

/* ---------- Points, happiness, ranks ---------- */
const RANKS = [
  {at: 0,  name: "Trainee Crawler"},
  {at: 10, name: "Crawler",         unlock: "a victory dance after games"},
  {at: 25, name: "Senior Crawler",  unlock: "gold lenses"},
  {at: 50, name: "Chief Engineer",  unlock: "a victory lap"}
];
const ST = Object.assign({points: 0, happy: 60, last: Date.now(), praiseAt: 0, cardAt: {}},
  (() => { try { return JSON.parse(localStorage.getItem("u7.stats")) || {}; } catch(e) { return {}; } })());
const saveStats = () => { try { localStorage.setItem("u7.stats", JSON.stringify(ST)); } catch(e) {} };
const rankIdx = (p = ST.points) => RANKS.reduce((k, r, i) => p >= r.at ? i : k, 0);
const goldUnlocked = () => rankIdx() >= 2;

function decay(){
  const days = Math.floor((Date.now() - ST.last) / 86400000);
  if (days >= 1) { ST.happy = Math.max(0, ST.happy - 10 * days); ST.last = Date.now(); saveStats(); }
}
function touch(){ ST.last = Date.now(); saveStats(); }
function bootKey(){ return ST.happy > 70 ? "bootHigh" : ST.happy < 30 ? "bootLow" : "boot"; }

function award(n){
  const before = rankIdx();
  ST.points += n; ST.happy = Math.min(100, ST.happy + 6 * n); touch();
  renderMeter(); sendHappy();
  if (window.personaPoints) personaPoints(n);
  const after = rankIdx();
  if (after > before) {
    S.hold = {m: "party", until: Date.now() + 7000};
    say(pick("promote", {rank: RANKS[after].name}));
    if (RANKS[after].unlock) say(pick("unlock", {what: RANKS[after].unlock}));
    renderSwatches();
  }
}
function sendHappy(){
  $("#visor").dataset.happy = ST.happy > 70 ? "high" : ST.happy < 30 ? "low" : "";
  if (S.eyes.linked) linkSend({t: "happy", h: ST.happy});
}
function renderMeter(){
  const i = rankIdx(), next = RANKS[i + 1];
  $("#rankName").textContent = RANKS[i].name;
  $("#points").textContent = ST.points + (ST.points === 1 ? " point" : " points");
  $("#nextRank").textContent = next ? (next.at - ST.points) + " to " + next.name : "Top rank reached";
  $("#happyBar").style.width = ST.happy + "%";
  $("#happyBar").parentElement.setAttribute("aria-valuenow", String(ST.happy));
  $("#happyLabel").textContent = ST.happy > 70 ? "Very happy" : ST.happy < 30 ? "Needs encouragement" : "Content";
}
const ENCOURAGE = {GOOD: 1, WELL: 2, BOLT: 3};

/* ---------- Gestures ---------- */
let gestureAt = 0;
const busyNow = () => !!(S.custom || S.driving || FOLLOW.on || robotBusy());
function onWave(){
  if (GAME.on || Date.now() - gestureAt < 5000 || busyNow()) return;
  gestureAt = Date.now(); touch();
  say(pick("gestureWave"));
  if (S.online) runAction(ACT.wave);
}
function onClap(n){
  if (GAME.on || Date.now() - gestureAt < 3000 || busyNow()) return;
  gestureAt = Date.now(); touch();
  if (n === 1) { look("up"); setTimeout(() => look(""), 1200); say(pick("clap1")); }
  else if (n === 2) { say(pick("clap2")); if (S.online) walkSteps(ACT.forward, 2, "Coming over"); }
  else { say(pick("clap3")); if (S.online) runAction(ACT["dance" + (1 + Math.floor(Math.random() * 3))]); }
}

/* ---------- Follow the light ---------- */
const FOLLOW = {on: false, light: null, seenAt: 0, tok: 0};
async function follow(mode){
  if (isEyes()) { say(pick("needLegs")); return "nolegs"; }
  if (!S.eyes.linked) { say(pick("needEyes")); return "noeyes"; }
  if (!S.online) { await refreshState(); if (!S.online) { say(pick("noLink")); return "nolink"; } }
  if (window.braveCheck) await braveCheck(mode);
  const tok = ++S.token;
  FOLLOW.on = true; FOLLOW.tok = tok; FOLLOW.light = null; FOLLOW.seenAt = Date.now();
  S.custom = mode === "seek" ? "Searching" : "Following the light"; renderStatus();
  linkSend({t: "follow", on: true});
  await makeRoom();
  let turns = 0, result = "stopped";
  while (FOLLOW.on && tok === S.token) {
    const L = FOLLOW.light, fresh = L && L.seen && Date.now() - FOLLOW.seenAt < 700;
    if (fresh) {
      turns = 0;
      if (mode === "seek" && L.area > 0.10) { result = "found"; break; }
      if (mode === "follow" && L.area > 0.25) { await sleep(300); continue; }   // close enough: wait
      const x = L.x * (P.lightInv ? -1 : 1);
      const id = x < -0.35 ? ACT.turnleft : x > 0.35 ? ACT.turnright : ACT.forward;
      S.pos = null; await req("POST", "/api/v1/action?id=" + id); await sleep(250); await waitIdle(6000);
    } else if (mode === "follow") {
      if (Date.now() - FOLLOW.seenAt > 3000) { result = "lost"; break; }
      await sleep(200);
    } else {
      if (turns >= 14) { result = "giveup"; break; }
      turns++;
      S.pos = null; await req("POST", "/api/v1/action?id=" + ACT.turnleft); await sleep(250); await waitIdle(6000);
      await sleep(500);   // let the camera settle before looking
    }
  }
  FOLLOW.on = false;
  linkSend({t: "follow", on: false});
  if (tok === S.token) { S.custom = null; renderStatus(); }
  if (mode === "follow" && result === "lost") say(pick("lightLost"));
  return result;
}

/* ---------- Games ---------- */
const GAME = {on: false, kind: null, score: 0, tok: 0, want: null, found: null, t0: 0};
const GAME_NAMES = {quiz: "Colour Quiz", copy: "Copy Me", seek: "Hide and Seek", hunt: "Treasure Hunt"};
const alive = g => GAME.on && GAME.tok === g;
const colourOf = code => { const p = code.split(":"); return p[0] === "UNIT7" && p[1] === "COLOR" && COLORS[(p[2] || "").toLowerCase()] ? p[2].toLowerCase() : null; };
const speakDone = () => sayChain;
function waitCard(ms){
  // A card shown a moment early (while Unit 7 was still talking) still counts.
  if (GAME.early && Date.now() - GAME.early.at < 4000) { const c = GAME.early.code; GAME.early = null; return Promise.resolve(c); }
  GAME.early = null;
  return new Promise(res => {
    const t = setTimeout(() => { GAME.want = null; res(null); }, ms);
    GAME.want = c => { clearTimeout(t); GAME.want = null; res(c); };
  });
}
function flash(c, on){
  applyColor(on ? c : P.color);
  if (S.eyes.linked) linkSend({t: "color", c: on ? c : P.color, temp: true});
}
const TONES = {red: 330, blue: 440, green: 554, purple: 659};
function tone(c){
  const ac = audio(); if (!ac || !P.sfx) return;
  const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime;
  o.type = "triangle"; o.frequency.value = TONES[c] || 500;
  g.gain.setValueAtTime(0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
  o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.52);
}

function startGame(kind){
  if (isEyes() && kind === "seek") { say(pick("needLegs")); return; }
  if (!S.eyes.linked && !isEyes()) { say(pick("needEyes")); return; }
  if (GAME.on) endGame(true);
  hush();
  Object.assign(GAME, {on: true, kind, score: 0, tok: GAME.tok + 1, want: null, found: new Set(), t0: Date.now()});
  linkSend({t: "game", on: true});
  if (isEyes()) SENSE.game = true;
  touch(); renderGame();
  const g = GAME.tok;
  ({quiz: runQuiz, copy: runCopy, seek: runSeek, hunt: runHunt})[kind](g);
}
function endGame(silent){
  if (!GAME.on) return;
  GAME.on = false; GAME.want = null;
  if (FOLLOW.on) FOLLOW.on = false;
  linkSend({t: "game", on: false});
  if (isEyes()) SENSE.game = false;
  flash(null, false);
  renderGame();
  if (!silent) say(pick("gameEnd"));
}
function finishGame(score, good, pts){
  const g = GAME.tok;
  if (!alive(g)) return;
  const won = score >= good;
  if (window.personaGame) personaGame(GAME.kind, score, won);
  say(pick(won ? "gameWin" : "gameTry", {n: score, game: GAME_NAMES[GAME.kind]}));
  endGame(true);
  if (pts > 0) award(pts);
  if (won && S.online) {
    const r = rankIdx();
    if (r >= 3) wiggle([ACT.turnleft, ACT.turnleft, ACT.turnleft, ACT.turnleft]);
    else if (r >= 1) runAction(ACT["dance" + (1 + Math.floor(Math.random() * 3))]);
  }
}
function renderGame(){
  const b = $("#gameBar");
  b.hidden = !GAME.on;
  if (!GAME.on) return;
  $("#gameName").textContent = GAME_NAMES[GAME.kind];
  $("#gameScore").textContent = GAME.kind === "hunt" ? GAME.found.size + " of 5 found"
    : GAME.kind === "seek" ? "Seeking…" : "Score " + GAME.score;
}

async function runQuiz(g){
  say(pick("quizStart")); await speakDone();
  const cols = ["red", "blue", "green", "purple", "white", "amber"];
  let last = null;
  for (let r = 1; r <= 5 && alive(g); r++) {
    let c; do { c = cols[Math.floor(Math.random() * cols.length)]; } while (c === last);
    last = c;
    say(pick("quizAsk", {c})); await speakDone();
    if (!alive(g)) return;
    let ok = false;
    const end = Date.now() + 12000;
    while (alive(g) && Date.now() < end) {
      const code = await waitCard(end - Date.now());
      if (!alive(g)) return;
      if (!code) break;
      const got = colourOf(code);
      if (!got) { say(pick("needColour")); continue; }
      if (got === c) { ok = true; break; }
      beep("down"); say(pick("quizWrong", {c: got}));
    }
    if (!alive(g)) return;
    if (ok) { GAME.score++; renderGame(); flash(c, true); beep("up"); say(pick("quizRight")); await speakDone(); flash(c, false); }
    else { say(pick("quizTimeout", {c})); await speakDone(); }
  }
  finishGame(GAME.score, 3, GAME.score);
}

async function runCopy(g){
  say(pick("copyStart")); await speakDone();
  const cols = ["red", "blue", "green", "purple"], seq = [];
  const add = () => { let c; do { c = cols[Math.floor(Math.random() * 4)]; } while (seq.length && c === seq[seq.length - 1]); seq.push(c); };
  add();
  while (alive(g) && GAME.score < 8) {
    add();
    say(pick("copyWatch", {n: seq.length})); await speakDone();
    for (const c of seq) {
      if (!alive(g)) return;
      flash(c, true); tone(c); await sleep(700); flash(c, false); await sleep(300);
    }
    say(pick("copyGo")); await speakDone();
    let ok = true;
    for (let i = 0; i < seq.length && alive(g); i++) {
      let code = await waitCard(10000);
      while (code && !colourOf(code) && alive(g)) { say(pick("needColour")); code = await waitCard(10000); }
      if (!alive(g)) return;
      const got = code && colourOf(code);
      if (got !== seq[i]) { ok = false; break; }
      tone(got); flash(got, true); setTimeout(() => flash(got, false), 400);
    }
    if (!alive(g)) return;
    if (!ok) { beep("down"); say(pick("copyFail", {n: GAME.score})); await speakDone(); break; }
    GAME.score++; renderGame(); say(pick("copyRight", {n: seq.length})); await speakDone();
  }
  finishGame(GAME.score, 3, GAME.score);
}

async function runSeek(g){
  say(pick("seekStart")); await speakDone();
  if (!alive(g)) return;
  S.hold = {m: "sleep", until: Date.now() + 15000};
  for (let n = 1; n <= 10 && alive(g); n++) { say(pick("count", {n})); await speakDone(); await sleep(350); }
  S.hold = null;
  if (!alive(g)) return;
  say(pick("seekReady")); await speakDone();
  const t0 = Date.now();
  const result = await follow("seek");
  if (!alive(g)) return;
  if (result === "found") {
    const s = Math.round((Date.now() - t0) / 1000);
    S.hold = {m: "happy", until: Date.now() + 5000};
    GAME.score = 1;
    say(pick("seekFound", {s}));
    finishGame(1, 1, 2);
  } else if (result === "giveup") { say(pick("seekGiveUp")); finishGame(0, 1, 1); }
  else endGame(true);
}

function runHunt(g){
  say(pick("huntStart"));
}
function huntCard(code){
  const n = +code.split(":")[2];
  if (!(n >= 1 && n <= 5)) return;
  if (GAME.found.has(n)) { say(pick("huntDup", {n})); return; }
  GAME.found.add(n); renderGame(); beep("up");
  S.hold = {m: "happy", until: Date.now() + 4000};
  if (GAME.found.size < 5) { say(pick("huntFound", {n, k: GAME.found.size})); award(1); return; }
  const secs = Math.round((Date.now() - GAME.t0) / 1000);
  const t = secs >= 60 ? Math.floor(secs / 60) + " minutes " + (secs % 60) + " seconds" : secs + " seconds";
  say(pick("huntDone", {t}));
  GAME.score = 5;
  finishGame(5, 5, 3);
}

/* ---------- Hooks used by app.js ---------- */
function playStop(){
  if (FOLLOW.on) FOLLOW.on = false;
  if (GAME.on && GAME.kind === "seek") endGame(true);
}
function playLink(m){
  if (m.t === "clap") onClap(m.n | 0);
  else if (m.t === "light") { FOLLOW.light = m; if (m.seen) FOLLOW.seenAt = Date.now(); }
}
function playCard(code){
  const p = code.split(":");
  if (p[0] !== "UNIT7") return false;
  if (p[1] === "GAME") {
    if (p[2] === "END") { if (GAME.on) endGame(false); else say(pick("noGame")); }
    else if (GAME_NAMES[(p[2] || "").toLowerCase()]) startGame(p[2].toLowerCase());
    return true;
  }
  if (p[1] === "FOLLOW") { if (!FOLLOW.on) { say(pick("followStart")); follow("follow"); } return true; }
  if (GAME.on) {
    if (GAME.kind === "hunt" && p[1] === "TREASURE") { huntCard(code); return true; }
    if (GAME.want) { GAME.want(code); return true; }
    if (GAME.kind !== "hunt" && p[1] === "COLOR") { GAME.early = {code, at: Date.now()}; return true; }   // colour cards belong to the game
  }
  if (p[1] === "TREASURE") { say(pick("treasureIdle")); return true; }
  if (p[1] === "ENCOURAGE") {
    const n = ENCOURAGE[p[2]];
    if (!n) return false;
    if (Date.now() - (ST.cardAt[p[2]] || 0) < 60000) { say(pick("encourageAgain")); return true; }
    ST.cardAt[p[2]] = Date.now();
    hush();
    S.hold = {m: "happy", until: Date.now() + 5000};
    say(pick("encourage" + n));
    award(n);
    return true;
  }
  return false;
}
function playParse(t, has){
  const gameWord = has("game","quiz","copy","seek","hunt","treasure");
  if (gameWord && has("end","stop","quit","over","finish","cancel")) return {cmd: "endgame"};
  if (has("quiz")) return {cmd: "game", kind: "quiz"};
  if (t.includes(" copy me ") || has("memory","simon")) return {cmd: "game", kind: "copy"};
  if (t.includes(" hide and seek ") || has("seek")) return {cmd: "game", kind: "seek"};
  if (has("treasure","hunt")) return {cmd: "game", kind: "hunt"};
  if (has("follow","flashlight","torch") || t.includes(" the light ")) return {cmd: "follow"};
  if (has("points","rank","score","level","promotion") || t.includes(" how happy ") || t.includes(" how are you ")) return {cmd: "status"};
  const col = Object.keys(COLORS).find(c => has(c));
  if (col && has("eyes","eye","lens","lenses","colour","color","turn","go","make")) return {cmd: "color", c: col};
  if (has("good","great","nice","awesome","clever","brilliant","amazing") || t.includes(" well done ")) return {cmd: "praise"};
  return null;
}
function playExecute(c){
  if (c.cmd === "endgame") { if (GAME.on) endGame(false); else say(pick("noGame")); return true; }
  if (c.cmd === "game") { startGame(c.kind); return true; }
  if (c.cmd === "follow") { if (!FOLLOW.on) { say(pick("followStart")); follow("follow"); } return true; }
  if (c.cmd === "status") {
    const i = rankIdx(), next = RANKS[i + 1];
    say(pick(ST.happy > 70 ? "statusHigh" : ST.happy < 30 ? "statusLow" : "status",
      {rank: RANKS[i].name, n: ST.points, left: next ? next.at - ST.points : 0, next: next ? next.name : "nothing"}));
    return true;
  }
  if (c.cmd === "color") {
    if (c.c === "gold" && !goldUnlocked()) { say(pick("goldLocked")); return true; }
    setColor(c.c); say(pick(c.c === "amber" ? "cardAmber" : "cardColor", {c: c.c})); return true;
  }
  if (c.cmd === "praise") {
    if (Date.now() - ST.praiseAt > 60000) { ST.praiseAt = Date.now(); S.hold = {m: "happy", until: Date.now() + 4000}; say(pick("praise")); award(1); }
    else say(pick("thanks"));
    return true;
  }
  return false;
}

/* ---------- Hands-free "Hey Unit 7" ---------- */
const WAKE_RE = /(hey |hi |hello |ok |a )?(unit|you knit|unit's|unix) ?(7|seven|set)\b/;
const GREET_RE = /^\s*(hello|hi)( there)?( (unit|you knit) ?(7|seven))?\s*$/;
let wakeArmed = 0, wakeT = null;
// The controller phone always listens for "Hey Unit 7" (unless the microphone isn't available).
const wakeOn = () => P.role === "ctl" && HAS && !S.micBlocked;
function wakeListen(delay){
  clearTimeout(wakeT);
  wakeT = setTimeout(() => {
    if (!wakeOn() || S.listening || document.hidden) return;
    if (S.speaking) { wakeListen(700); return; }   // don't listen to his own voice
    S.wakeListening = true;
    Android.listen(!!P.offline);
  }, delay || 400);
}
function wakeResume(){ if (wakeOn()) wakeListen(800); }
function wakeHeard(kind, data){
  if (kind === "ready" || kind === "end") return;
  if (kind === "partial") { if (data && data[0]) $("#heard").textContent = "…" + data[0]; return; }
  S.wakeListening = false;
  if (kind === "error") {
    const code = String(data);
    if (code === "9" || code === "mic-permission" || code === "no-recognizer") { S.micBlocked = true; toast("“Hey Unit 7” needs microphone access and a speech service on this phone."); return; }
    wakeListen(code === "8" ? 1500 : 400);
    return;
  }
  const list = (data || []).map(x => String(x).toLowerCase());
  // Ignore anything heard while Unit 7 was talking (he says his own name a lot).
  if (S.speaking || Date.now() - (S.spokeAt || 0) < 1000) { wakeListen(400); return; }
  if (window.personaAsking && personaAsking() && list.length) {
    $("#heard").textContent = "You: " + list[0]; execute(parse(list[0])); wakeListen(400); return;
  }
  for (const alt of list) {
    if (GREET_RE.test(alt)) { wakeArmed = 0; $("#heard").textContent = "You: " + alt; execute({cmd: "wave"}); break; }
    if (Date.now() < wakeArmed) {
      const c = parse(alt);
      if (c) { wakeArmed = 0; $("#heard").textContent = "You: " + alt; execute(c); break; }
      continue;
    }
    const m = alt.match(WAKE_RE);
    if (!m) continue;
    const rest = alt.slice(m.index + m[0].length);
    const c = parse(rest);
    $("#heard").textContent = "You: " + alt;
    if (c) execute(c);
    else { wakeArmed = Date.now() + 8000; beep("up"); setMood("listen"); say(pick("wakeYes")); }
    break;
  }
  wakeListen(400);
}

/* ---------- UI ---------- */
function playInit(){
  decay(); renderMeter(); renderGame();
  $("#endGameBtn").addEventListener("click", () => endGame(false));
  $$("[data-game]").forEach(b => b.addEventListener("click", () => { audio(); startGame(b.dataset.game); }));
  $("#followBtn").addEventListener("click", () => { audio(); if (FOLLOW.on) { emergencyStop(true); } else { say(pick("followStart")); follow("follow"); } });
  const li = $("#pLightInv"); li.checked = !!P.lightInv;
  li.addEventListener("change", () => { P.lightInv = li.checked; savePrefs(); });
  const prevResume = U7.onResume;
  U7.onResume = () => { if (prevResume) prevResume(); S.micBlocked = false; if (wakeOn()) wakeListen(600); };
  if (P.role === "ctl") {
    sendHappy();
    if (wakeOn()) wakeListen(2500);
    setInterval(() => {   // a lonely Unit 7 asks for attention now and then
      decay();
      if (ST.happy < 30 && !GAME.on && !busyNow() && Date.now() - ST.last > 5 * 60000 && !S.listening) say(pick("lonely"));
    }, 6 * 60000);
  }
}
