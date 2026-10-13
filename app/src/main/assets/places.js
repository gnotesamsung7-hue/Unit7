"use strict";
/* Places: "Unit 7, this is a new place" → he asks what it's called, then keeps a journal of
   what you talk about there (plus people met and games played). Later: "what did we talk
   about at the beach?", "where have we been?", "where are we?". Stored on this phone only. */

const PLACES_KEY = "u7.places";
let PLACES = (() => { try { return JSON.parse(localStorage.getItem(PLACES_KEY)) || []; } catch(e) { return []; } })();
const savePlaces = () => { try { localStorage.setItem(PLACES_KEY, JSON.stringify(PLACES)); } catch(e) {} };
const VISIT = {place: null, visit: null};   // the visit in progress

Object.assign(LINES, {
  placeAsk: [["listen", "[Gyro whir] A new place! Exciting. What's it called?"]],
  placeNamed: [["happy", "{place}! Logged. I'll remember what we talk about here."]],
  placeAgain: [["happy", "{place}! We've been here before. This is visit number {n}.{last}"]],
  placeExplore: [["listen", "Shall I have a look around?"]],
  placeWhere: [["think", "We're at {place}. I've logged {n} things we talked about here so far."]],
  placeUnknown: [["think", "I'm not sure where we are. Tell me: this is a new place called… and then the name."]],
  placeLeave: [["happy", "Logging our visit to {place}. Goodbye, {place}! I had a great time."]],
  placeRecall: [["happy", "At {place} {when}: {summary}"]],
  placeRecallNone: [["think", "I don't have any notes about {place} yet. We mostly just looked around."]],
  placeNotFound: [["think", "I don't remember a place called {place}. We've been to {list}."]],
  placesList: [["happy", "We've been to {list}. Ask me what we talked about at any of them."]],
  placesNone: [["think", "We haven't logged any places yet. Tell me when we're somewhere new!"]],
  placesForgot: [["think", "Done. I've forgotten all our places."]],
  placeNameUnclear: [["think", "I didn't catch the name. I'll call it the mystery place for now. You can say: this place is called… anytime."]]
});

/* ---------- Helpers ---------- */
const titleCase = s => s.split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
function cleanPlace(raw){
  let s = String(raw || "").toLowerCase().replace(/[.!?,]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^(this is |this place is |it is |it's |its |we're at |we are at |we're in |we are in |welcome to |the place is |it's called |called |a new place called |new place called )+/, "");
  s = s.replace(/\s+(now|today|right now)$/, "").trim();
  if (!s || s.split(" ").length > 6 || /^(yes|no|okay|ok|i don't know|dunno|not sure)$/.test(s)) return null;
  return titleCase(s);
}
const placeKey = s => String(s).toLowerCase().replace(/^(the|a|an|our|my) /, "").trim();
function findPlace(name){
  if (!name) return null;
  const n = placeKey(name);
  return PLACES.find(p => placeKey(p.name) === n) ||
         PLACES.find(p => placeKey(p.name).includes(n) || n.includes(placeKey(p.name))) || null;
}
const whenText = ts => {
  const d = new Date(ts), today = new Date();
  const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : "on " + d.toLocaleDateString([], {month: "long", day: "numeric"});
};
// "I'm so tired" → "you're so tired"
function second(text){
  let s = " " + String(text).toLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " ") + " ";
  const map = [[" i'm ", " you're "], [" im ", " you're "], [" i am ", " you are "], [" i was ", " you were "], [" i've ", " you've "],
    [" i'd ", " you'd "], [" i ", " you "], [" my ", " your "], [" me ", " you "], [" mine ", " yours "], [" myself ", " yourself "]];
  for (const [a, b] of map) s = s.split(a).join(b);
  return s.trim();
}

/* ---------- Visits ---------- */
function startVisit(name){
  endVisit(true);
  let place = findPlace(name);
  const again = !!place;
  if (!place) { place = {name, visits: []}; PLACES.push(place); }
  const visit = {start: Date.now(), end: null, items: [], met: [], games: []};
  place.visits.push(visit);
  VISIT.place = place; VISIT.visit = visit;
  savePlaces(); renderPlaces();
  if (again && place.visits.length > 1) {
    const prev = place.visits[place.visits.length - 2];
    const told = prev.items.filter(i => i.w === "you" && /^(chat|chatAnswer)$/.test(i.k) && i.t.split(" ").length >= 3 && !/^(what|where|how|why|who|when|do|can|tell me)\b/i.test(i.t.trim())).map(i => i.t);
    const last = told.length ? " Last time you told me " + second(told[told.length - 1]) + "." : "";
    say(pick("placeAgain", {place: place.name, n: place.visits.length, last}));
  } else say(pick("placeNamed", {place: place.name}));
  if (typeof SES !== "undefined") SES.events.push("visited " + place.name);
  // Offer a look around if he has eyes and legs.
  if (P.role === "ctl" && S.eyes.linked && S.eyes.kind !== "head" && typeof exploreStart === "function" && !EXP.on) {
    say(pick("placeExplore")); CONVO.ask = "placeExplore"; CONVO.until = Date.now() + 15000; afterReply();
  }
}
function endVisit(silent){
  if (!VISIT.visit) return;
  VISIT.visit.end = Date.now();
  const name = VISIT.place.name;
  VISIT.place = null; VISIT.visit = null;
  savePlaces(); renderPlaces();
  if (!silent) say(pick("placeLeave", {place: name}));
}
function record(w, t, kind){
  const v = VISIT.visit;
  if (!v || !t) return;
  if (Date.now() - (v.items.length ? v.items[v.items.length - 1].ts : v.start) > 6 * 3600000) { endVisit(true); return; }
  v.items.push({w, t: String(t).slice(0, 160), k: kind || "", ts: Date.now()});
  if (v.items.length > 80) v.items.splice(0, v.items.length - 80);
  savePlaces();
}

/* ---------- Recall ---------- */
function summarise(place, visit){
  const parts = [];
  const QUESTION = /^(what|where|how|why|who|when|do|does|did|can|could|are|is|tell me|hey)\b/i;
  const told = visit.items.filter(i => i.w === "you" && /^(chat|chatAnswer|answer|setname)$/.test(i.k) &&
    i.t.split(" ").length >= 3 && !QUESTION.test(i.t.trim())).map(i => second(i.t));
  if (told.length) parts.push("you told me " + told.slice(0, 3).join("; and ") + ".");
  const asked = visit.items.filter(i => i.w === "you" && /^(joke|story|fact)$/.test(i.k)).length;
  if (asked) parts.push("I told you " + asked + " joke" + (asked > 1 ? "s and stories" : " or story") + ".");
  if (visit.met.length) parts.push("We met " + visit.met.join(" and ") + ".");
  if (visit.games.length) parts.push("We played " + visit.games.join(", ") + ".");
  const chats = visit.items.filter(i => i.w === "you").length;
  if (!parts.length && chats) parts.push("we chatted " + chats + " time" + (chats > 1 ? "s" : "") + ", mostly small talk.");
  return parts.join(" ");
}
function recall(name){
  let place, visit;
  if (name) {
    place = findPlace(name);
    if (!place) { say(pick(PLACES.length ? "placeNotFound" : "placesNone", {place: name, list: listText()})); return; }
    visit = [...place.visits].reverse().find(v => v.items.length || v.met.length || v.games.length) || place.visits[place.visits.length - 1];
  } else if (VISIT.visit && (VISIT.visit.items.length > 1)) { place = VISIT.place; visit = VISIT.visit; }
  else {
    const all = PLACES.flatMap(p => p.visits.map(v => ({p, v}))).sort((a, b) => b.v.start - a.v.start);
    if (!all.length) { say(pick("placesNone")); return; }
    place = all[0].p; visit = all[0].v;
  }
  const summary = summarise(place, visit);
  if (!summary) { say(pick("placeRecallNone", {place: place.name})); return; }
  say(pick("placeRecall", {place: place.name, when: whenText(visit.start), summary}));
}
function listText(){
  const names = PLACES.map(p => p.name + (p.visits.length > 1 ? " (" + p.visits.length + " visits)" : ""));
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

/* ---------- Voice ---------- */
const prevPersonaParseP = personaParse;
personaParse = function(t, has, raw){
  if (chatAsking() || personaAsking()) return prevPersonaParseP(t, has, raw);
  if (t.includes(" forget all places ") || t.includes(" forget our places ") || t.includes(" forget every place ")) return {cmd: "placesForget"};
  if (/ what did we (talk|chat) about /.test(t) || / remember (when we went|our trip|our visit) /.test(t) || / tell me about our (trip|visit) /.test(t)) {
    const m = String(raw).toLowerCase().match(/(?:about|went|trip|visit)\s+(?:at|in|to)\s+(?:the\s+)?(.+?)[.?!]*$/);
    return {cmd: "placeRecall", name: m ? cleanPlace(m[1]) : null};
  }
  if (/ where have we been | places we ve been | what places /.test(t)) return {cmd: "placesList"};
  if (/ where are we /.test(t)) return {cmd: "placeWhere"};
  if (/ (we re leaving|we are leaving|time to go home|let s go home|lets go home|goodbye place|we re done here|leaving now) /.test(t)) return {cmd: "placeLeave"};
  if (/ (new place|this place is called|we re at|we are at|we re in|we are in|welcome to|we just arrived|we re here at|we arrived at) /.test(t)) {
    const r = String(raw).replace(/unit\s*(7|seven)/ig, " ");
    const m = r.match(/(?:called|we'?re at|we are at|we'?re in|we are in|welcome to|arrived at|here at)\s+(.+)$/i);
    return {cmd: "placeNew", name: m ? cleanPlace(m[1]) : null};
  }
  return prevPersonaParseP(t, has, raw);
};
const prevPersonaExecuteP = personaExecute;
personaExecute = function(c){
  switch (c.cmd) {
    case "placeNew":
      if (c.name) startVisit(c.name);
      else { say(pick("placeAsk")); CONVO.ask = "placeName"; CONVO.until = Date.now() + 20000; afterReply(); }
      return true;
    case "placeRecall": recall(c.name); return true;
    case "placesList": say(pick(PLACES.length ? "placesList" : "placesNone", {list: listText()})); return true;
    case "placeWhere":
      if (VISIT.visit) say(pick("placeWhere", {place: VISIT.place.name, n: VISIT.visit.items.filter(i => i.w === "you").length}));
      else say(pick("placeUnknown"));
      return true;
    case "placeLeave": if (VISIT.visit) endVisit(false); else say(pick("chatBye")); return true;
    case "placesForget": endVisit(true); PLACES = []; savePlaces(); renderPlaces(); say(pick("placesForgot")); return true;
  }
  return prevPersonaExecuteP(c);
};
// Answers to "What's it called?" and "Shall I have a look around?"
const prevChatAnswerP = chatAnswer;
chatAnswer = function(t){
  if (CONVO.ask === "placeName") {
    CONVO.ask = null;
    const name = cleanPlace(S.firstHeard || t);
    startVisit(name || "The Mystery Place");
    if (!name) say(pick("placeNameUnclear"));
    return;
  }
  if (CONVO.ask === "placeExplore") {
    CONVO.ask = null;
    if (YES.test(t) && !NO.test(t)) exploreStart(); else chatSay("chatOkay");
    return;
  }
  prevChatAnswerP(t);
};

/* ---------- Recording the conversation during a visit ---------- */
let lastRecordedParse = 0;
const prevExecuteP = execute;
execute = function(c){
  if (VISIT.visit && S.firstHeard && S.parseAt !== lastRecordedParse && Date.now() - (S.parseAt || 0) < 3000) {
    lastRecordedParse = S.parseAt;
    if (!c || !/^place/.test(c.cmd)) record("you", S.firstHeard, c ? c.cmd : "chat");
  }
  return prevExecuteP(c);
};
const prevSayP = say;
say = function(line){
  if (VISIT.visit && line && line.text) record("u7", line.text.replace(/\[[^\]]+\]\s*/g, "").trim(), "");
  return prevSayP(line);
};
// People met and games played during a visit.
const prevPersonaGameP = personaGame;
personaGame = function(kind, score, won){
  if (VISIT.visit) { VISIT.visit.games.push(GAME_NAMES[kind]); savePlaces(); }
  return prevPersonaGameP(kind, score, won);
};
function placeMet(name){
  if (VISIT.visit && name && !VISIT.visit.met.includes(name)) { VISIT.visit.met.push(name); savePlaces(); }
}

/* ---------- Files screen ---------- */
function renderPlaces(){
  const el = $("#placeList");
  if (!el) return;
  if (!PLACES.length) { el.innerHTML = '<p class="note">No places yet. Say “Hey Unit 7, this is a new place”.</p>'; return; }
  const esc = s => String(s).replace(/[<>&]/g, c => ({"<": "&lt;", ">": "&gt;", "&": "&amp;"}[c]));
  el.innerHTML = [...PLACES].reverse().map(p => {
    const v = p.visits[p.visits.length - 1];
    const rich = [...p.visits].reverse().find(x => summarise(p, x));
    const s = rich ? (rich !== v ? whenText(rich.start).replace(/^on /, "On ").replace(/^today/, "Earlier today").replace(/^yesterday/, "Yesterday") + ", " : "") + summarise(p, rich) : "We looked around.";
    return '<div class="entry"><strong>' + esc(p.name) + ' · ' + whenText(v.start) + (p.visits.length > 1 ? " · " + p.visits.length + " visits" : "") +
      (VISIT.place === p ? " · here now" : "") + '</strong><p>' + esc(s.charAt(0).toUpperCase() + s.slice(1)) + '</p></div>';
  }).join("");
}
window.addEventListener("load", () => {
  renderPlaces();
  const lb = $("#logBtn"); if (lb) lb.addEventListener("click", renderPlaces);
  const fp = $("#forgetPlaces");
  if (fp) fp.addEventListener("click", () => { endVisit(true); PLACES = []; savePlaces(); renderPlaces(); toast("Unit 7 has forgotten all places."); });
});
