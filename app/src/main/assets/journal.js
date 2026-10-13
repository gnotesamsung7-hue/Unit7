"use strict";
/* Daily check-ins and journaling (offline). Once a day Unit 7 asks how you're feeling, asks one
   follow-up and one journaling prompt, and keeps it all in a journal on this phone. You can also
   say "check in", "journal entry", "how was my week?" or "what did I write yesterday?". */

const JOURNAL_KEY = "u7.journal";
let JOURNAL = (() => { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY)) || []; } catch(e) { return []; } })();
const saveJournal = () => { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(JOURNAL.slice(-400))); } catch(e) {} };
const JR = {step: null, until: 0, entry: null, fromEyes: false, tries: {}, lastTry: 0};
const journalAsking = () => !!JR.step && Date.now() < JR.until;
const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const doneToday = () => JOURNAL.some(e => e.day === dayKey() && e.kind === "checkin");

Object.assign(LINES, {
  jrStart: [["listen", "[Gyro whir] Check-in time! How are you feeling today, {name}? Great, okay, or rough?"]],
  jrHigh: [["happy", "[Leg tap] That's wonderful! What made today good?"]],
  jrMid: [["think", "Okay is okay. What's one thing on your mind today?"]],
  jrLow: [["worried", "I'm sorry it's a rough one, {name}. Do you want to tell me what happened? You can say skip."]],
  jrUnclear: [["think", "I'll note that down as somewhere in the middle. What's one thing on your mind today?"]],
  jrPrompt: [
    ["listen", "Journal question: what's one thing you're grateful for today?"],
    ["listen", "Journal question: what's something you're looking forward to?"],
    ["listen", "Journal question: who made you smile today?"],
    ["listen", "Journal question: what did you learn today?"],
    ["listen", "Journal question: what was the best moment of your day?"]
  ],
  jrPromptLow: [["listen", "One more, and it's a gentle one. What's one small thing that might help tomorrow?"]],
  jrSaved: [["happy", "Logged in your journal. Thank you for sharing, {name}."]],
  jrSavedLow: [["happy", "Thank you for telling me. Be kind to yourself tonight, {name}. And if it ever feels really heavy, talk to someone you trust."]],
  jrSkip: [["happy", "Skipped. That's fine."]],
  jrLater: [["happy", "No worries. We can check in later. Just say: check in."]],
  jrAlready: [["happy", "We already checked in today, {name}. Want to add a journal entry instead? Say: journal entry."]],
  jrFreeAsk: [["listen", "Journal open. Go ahead, I'm listening."]],
  jrFreeSaved: [["happy", "[Leg tap] Saved to your journal."]],
  jrWeek: [["happy", "This week you checked in {n} times, and you felt mostly {avg}. {best}{low}{grat}"]],
  jrWeekNone: [["think", "We haven't checked in this week yet. Say: check in, and we'll start."]],
  jrRead: [["think", "{when} you felt {mood}. {text}"]],
  jrReadNone: [["think", "I don't have a journal entry for {when}."]],
  jrForgot: [["think", "Done. Your journal is cleared."]],
  jrCare: [["worried", "{name}, I'm really glad you told me, and I care about you. I'm only a small robot, so please talk to someone who can help right now. In the Philippines you can call the NCMH crisis hotline on 1553, any time, day or night. If you're in danger, call 911."]]
});

/* ---------- Reading feelings ---------- */
function moodScore(t){
  if (/\b(great|amazing|awesome|fantastic|excellent|wonderful|really good|very good|masaya|super)\b/.test(t)) return 5;
  if (/\b(rough|bad|sad|terrible|awful|horrible|upset|angry|lonely|depressed|crying|malungkot|worst|miserable)\b/.test(t)) return 1;
  if (/\b(tired|stressed|not great|not good|meh|so so|so-so|anxious|worried|pagod|sick|exhausted)\b/.test(t)) return 2;
  if (/\b(good|happy|nice|fine|well)\b/.test(t)) return 4;
  if (/\b(okay|ok|alright|all right|average|normal|okay lang)\b/.test(t)) return 3;
  return 0;
}
const MOOD_WORD = {1: "rough", 2: "a bit low", 3: "okay", 4: "good", 5: "great"};
const SKIP = /\b(skip|pass|next|no thanks|not now|nothing|never mind|nevermind)\b/;
// Words that mean someone may be in danger. Always answered with care and a real hotline.
const CRISIS = /\b(kill myself|killing myself|suicide|suicidal|end my life|want to die|wanna die|don't want to live|dont want to live|hurt myself|harm myself|self harm|self-harm|cut myself|better off dead|no reason to live)\b/;

function careResponse(){
  hush();
  S.hold = {m: "worried", until: Date.now() + 15000};
  say(pick("jrCare"));
  toast("NCMH Crisis Hotline: 1553 · Globe/TM 0917-899-8727 · Smart/TNT 0919-057-1553 · Emergency 911", 20000);
  JR.step = null;
}

/* ---------- The check-in ---------- */
function askNext(step, key, vars){
  JR.step = step; JR.until = Date.now() + 25000;
  say(pick(key, vars));
  journalListen();
}
async function journalListen(){
  await sayChain;
  if (!journalAsking()) return;
  JR.until = Date.now() + 20000;
  if (P.role === "ctl") {
    if (typeof wakeArmed !== "undefined") wakeArmed = JR.until;
    if (JR.fromEyes && S.eyes.linked) linkSend({t: "listen"});
  } else if (isEyes() && S.ctlAsleep && !S.listening) startListen();
  const mine = JR.step;
  setTimeout(() => { if (JR.step === mine && Date.now() >= JR.until) timeoutCheckin(); }, 20500);
}
function timeoutCheckin(){
  if (!JR.step) return;
  if (JR.entry && JR.entry.mood) finishCheckin(); else { JR.step = null; JR.entry = null; say(pick("jrLater")); }
}
function startCheckin(manual){
  if (doneToday() && manual) { say(pick("jrAlready")); return; }
  JR.entry = {day: dayKey(), ts: Date.now(), kind: "checkin", mood: 0, answers: []};
  JR.tries[dayKey()] = (JR.tries[dayKey()] || 0) + 1; JR.lastTry = Date.now();
  hush();
  askNext("mood", "jrStart");
}
function finishCheckin(){
  const e = JR.entry; JR.step = null; JR.entry = null;
  if (!e) return;
  if (!e.mood) e.mood = 3;
  JOURNAL.push(e); saveJournal(); renderJournal();
  if (typeof SES !== "undefined") SES.events.push("had a check-in (" + MOOD_WORD[e.mood] + ")");
  say(pick(e.mood <= 2 ? "jrSavedLow" : "jrSaved"));
  if (new Date().getDay() === 0) setTimeout(() => weekSummary(), 800);   // Sundays: a look back at the week
}
function journalAnswer(t, raw){
  const step = JR.step;
  JR.step = null;
  if (CRISIS.test(t)) { if (JR.entry) { JR.entry.answers.push({q: step, a: raw}); JOURNAL.push(JR.entry); saveJournal(); JR.entry = null; } careResponse(); return; }
  if (step === "free") { JOURNAL.push({day: dayKey(), ts: Date.now(), kind: "note", mood: 0, answers: [{q: "note", a: raw}]}); saveJournal(); renderJournal(); say(pick("jrFreeSaved")); return; }
  const e = JR.entry; if (!e) return;
  if (step === "mood") {
    const m = moodScore(t);
    e.mood = m || 3; e.word = raw;
    S.hold = {m: e.mood >= 4 ? "happy" : e.mood <= 2 ? "worried" : "think", until: Date.now() + 6000};
    askNext("follow", m >= 4 ? "jrHigh" : m && m <= 2 ? "jrLow" : m ? "jrMid" : "jrUnclear");
    return;
  }
  if (step === "follow") {
    if (SKIP.test(t)) say(pick("jrSkip")); else e.answers.push({q: "follow", a: raw});
    askNext("prompt", e.mood <= 2 ? "jrPromptLow" : "jrPrompt");
    return;
  }
  if (step === "prompt") {
    if (!SKIP.test(t)) e.answers.push({q: "prompt", a: raw});
    finishCheckin();
  }
}

/* ---------- Looking back ---------- */
function weekSummary(){
  const since = Date.now() - 7 * 86400000;
  const week = JOURNAL.filter(e => e.kind === "checkin" && e.ts >= since);
  if (!week.length) { say(pick("jrWeekNone")); return; }
  const avg = week.reduce((s, e) => s + e.mood, 0) / week.length;
  const dayName = ts => new Date(ts).toLocaleDateString([], {weekday: "long"});
  const best = week.reduce((a, b) => b.mood > a.mood ? b : a);
  const low = week.reduce((a, b) => b.mood < a.mood ? b : a);
  const grat = [...week].reverse().map(e => (e.answers.find(a => a.q === "prompt") || {}).a).find(Boolean);
  say(pick("jrWeek", {
    n: week.length, avg: MOOD_WORD[Math.round(avg)],
    best: best.mood >= 4 ? "Your best day was " + dayName(best.ts) + ". " : "",
    low: low.mood <= 2 && low !== best ? dayName(low.ts) + " was a tough one, but you got through it. " : "",
    grat: grat ? "One thing you shared: " + second(grat) + "." : ""
  }));
}
function readDay(which){
  const d = new Date(); if (which === "yesterday") d.setDate(d.getDate() - 1);
  const key = dayKey(d), when = which === "yesterday" ? "Yesterday" : "Today";
  const es = JOURNAL.filter(e => e.day === key);
  if (!es.length) { say(pick("jrReadNone", {when: when.toLowerCase()})); return; }
  const c = es.find(e => e.kind === "checkin");
  const texts = es.flatMap(e => e.answers.map(a => a.a)).filter(Boolean).slice(0, 3).map(second);
  say(pick("jrRead", {when, mood: c ? MOOD_WORD[c.mood] : "like writing", text: texts.length ? "You wrote: " + texts.join(". ") + "." : ""}));
}

/* ---------- Voice ---------- */
const prevPersonaParseJ = personaParse;
personaParse = function(t, has, raw){
  if (CRISIS.test(t)) return {cmd: "journalCare"};
  if (journalAsking() && !has("stop","halt","freeze","cancel")) return {cmd: "journalAnswer", t, raw: S.firstHeard || raw};
  if (/ (check in|check-in|checkin|daily check) /.test(t)) return {cmd: "journalCheckin"};
  if (/ (journal entry|write in my journal|add to my journal|dear diary|open my journal|journal this) /.test(t)) return {cmd: "journalFree"};
  if (/ (how was my week|my week summary|weekly summary|how have i been) /.test(t)) return {cmd: "journalWeek"};
  if (/ (what did i write|read my journal|my journal) /.test(t)) return {cmd: "journalRead", which: has("yesterday") ? "yesterday" : "today"};
  if (/ (forget my journal|clear my journal|delete my journal) /.test(t)) return {cmd: "journalForget"};
  return prevPersonaParseJ(t, has, raw);
};
const prevPersonaExecuteJ = personaExecute;
personaExecute = function(c){
  switch (c.cmd) {
    case "journalCare": careResponse(); return true;
    case "journalAnswer": journalAnswer(c.t, c.raw); return true;
    case "journalCheckin": startCheckin(true); return true;
    case "journalFree": JR.entry = null; askNext("free", "jrFreeAsk"); return true;
    case "journalWeek": weekSummary(); return true;
    case "journalRead": readDay(c.which); return true;
    case "journalForget": JOURNAL = []; saveJournal(); renderJournal(); say(pick("jrForgot")); return true;
  }
  return prevPersonaExecuteJ(c);
};
// Which phone you're talking into, so he listens on the right one for your answer.
const prevPlayLinkJ = playLink;
playLink = function(m){ if (m.t === "heard") JR.fromEyes = true; prevPlayLinkJ(m); };
const prevStartListenJ = startListen;
startListen = function(){ JR.fromEyes = false; prevStartListenJ(); };

/* ---------- Asking once a day, at a good moment ---------- */
setInterval(() => {
  if (P.checkin === false || !booted || JR.step || doneToday()) return;
  if (!(P.role === "ctl" || (isEyes() && S.ctlAsleep))) return;
  if (typeof idleReady === "function" && !idleReady()) return;
  if (typeof LIFE !== "undefined" && (LIFE.dozing || Date.now() - LIFE.lastUser > 120000)) return;   // only when you're around
  if (S.speaking || Date.now() - (S.spokeAt || 0) < 8000 || Date.now() - (S.parseAt || 0) < 20000) return;
  const h = new Date().getHours(), evening = (P.checkinTime || "evening") === "evening";
  if (evening ? (h < 18 || h >= 22) : (h < 7 || h >= 11)) return;
  if ((JR.tries[dayKey()] || 0) >= 2 || Date.now() - JR.lastTry < 3600000) return;
  startCheckin(false);
}, 30000);

/* ---------- Files screen ---------- */
function renderJournal(){
  const el = $("#journalList"), strip = $("#moodStrip");
  if (!el || !strip) return;
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  strip.innerHTML = days.map(d => {
    const c = JOURNAL.filter(e => e.day === dayKey(d) && e.kind === "checkin").pop();
    const m = c ? c.mood : 0;
    return '<div class="mday"><div class="mbar m' + m + '" style="height:' + (m ? 12 + m * 9 : 6) + 'px"></div><span>' +
      d.toLocaleDateString([], {weekday: "narrow"}) + '</span></div>';
  }).join("");
  const esc = s => String(s).replace(/[<>&]/g, c => ({"<": "&lt;", ">": "&gt;", "&": "&amp;"}[c]));
  const recent = [...JOURNAL].reverse().slice(0, 14);
  el.innerHTML = recent.length ? recent.map(e => {
    const when = new Date(e.ts).toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"});
    const head = e.kind === "checkin" ? "Check-in · feeling " + MOOD_WORD[e.mood] : "Journal note";
    const body = e.answers.map(a => esc(a.a)).join("<br>") || (e.word ? esc(e.word) : "");
    return '<div class="entry"><strong>' + when + ' · ' + head + '</strong>' + (body ? '<p>' + body + '</p>' : '') + '</div>';
  }).join("") : '<p class="note">No entries yet. Say “Hey Unit 7, check in” or “journal entry”.</p>';
}
window.addEventListener("load", () => {
  renderJournal();
  const lb = $("#logBtn"); if (lb) lb.addEventListener("click", renderJournal);
  const fj = $("#forgetJournal"); if (fj) fj.addEventListener("click", () => { JOURNAL = []; saveJournal(); renderJournal(); toast("Journal cleared."); });
  const ci = $("#pCheckin"); if (ci) { ci.checked = P.checkin !== false; ci.addEventListener("change", () => { P.checkin = ci.checked; savePrefs(); }); }
  $$("[data-ctime]").forEach(b => {
    b.setAttribute("aria-checked", String((P.checkinTime || "evening") === b.dataset.ctime));
    b.addEventListener("click", () => { P.checkinTime = b.dataset.ctime; savePrefs(); $$("[data-ctime]").forEach(x => x.setAttribute("aria-checked", String(x === b))); });
  });
});
