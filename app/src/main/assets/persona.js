"use strict";
/* Unit 7's personality (controller phone): idle life and daily rhythm, reactions to his body,
   memory of you, the story of the missing Units 1-6, conversation, and traits that grow. */

/* ---------- Unit 7's personality lines ---------- */
Object.assign(LINES, {
  bootMorning: [["happy", "[Gyro whir] Good morning, {name}. Overnight bolt inspection complete. Zero loose bolts. Well, one. I fixed it."]],
  greetMorning: [["happy", "Good morning, {name}! Lenses polished, legs ready."]],
  greetAfternoon: [["happy", "Good afternoon, {name}. Unit 7, online and ready for work orders."]],
  greetEvening: [["happy", "Good evening, {name}. Time for some evening maintenance? Or games. Games is also fine."]],
  greetNight: [["sleep", "[Yawn] Oh, hello {name}. It's very late. Even crawlers have recharge cycles."]],
  dozeOff: [["sleep", "[Yawn] Nobody needs me right now. Entering low-power mode. Wake me if a bolt needs checking."]],
  dozeWake: [["surprised", "Huh? I'm awake! I wasn't sleeping. I was… defragmenting."], ["surprised", "[Gyro whir] Rebooting. I dreamed I had eight legs. It was confusing."]],
  snore: [["sleep", "[Snore]"], ["sleep", "[Snore] …four-point stability… [Snore]"]],
  goodnight: [["sleep", "Good night, {name}. I'll log today's work and power down. [Yawn]"]],
  idleBolt: [["think", "[Leg tap] Routine bolt inspection."], ["think", "Checking my leg bolts. One of them looked at me funny."]],
  idleStretch: [["happy", "Stretching. One leg, two legs, three legs, four. Ahh."]],
  idleLook: [["think", "Just scanning the area. Nothing suspicious. Except that sock."], ["think", "Looking around. Routine surveillance."]],
  idleHum: [["happy", "[Hum] That's the Aegis maintenance anthem. It has four verses, one per leg."], ["happy", "[Hum] Sorry. I hum when I'm content."]],
  idleYawn: [["sleep", "[Yawn] It's getting late, {name}. Maybe one more game, then sleep?"]],
  remark: [
    ["think", "Did you know a crawler's left rear leg does thirty percent of the work? I've never told the other legs."],
    ["think", "I wonder if the Origin Press has carpet. My feet like carpet."],
    ["happy", "This floor is very well maintained. I approve."],
    ["think", "If I had a fifth leg, I would use it only for waving."],
    ["think", "Vacuum cleaners. Why are they so loud? What are they hiding?"]
  ],
  remarkMorning: [["happy", "Mornings are excellent for maintenance. Everything is shiny and nothing has broken yet."]],
  memSteps: [["happy", "We've walked about {n} steps together, {name}. That's a lot of leg work."]],
  memWins: [["happy", "We've won {n} games together. I keep the trophies in my memory banks."]],
  memDays: [["happy", "{n} days since I first came online with you. Best days of my service record."]],
  memFav: [["happy", "Your favourite colour is {c}. I logged it. I check it sometimes, just to feel organised."]],
  memPeek: [["happy", "We've played peekaboo {n} times. I'm getting very good at being surprised."]],
  crew: [
    ["happy", "I miss Sparky. He's the only one who laughs at my bolt jokes."],
    ["think", "Whirr says flying is easier than walking. Whirr has never had to carry a phone on his back."],
    ["think", "Chief once called me reliable. I've replayed that recording four hundred times."]
  ],
  lonely: [["sad", "[Joint creak] Has anyone seen a Good Job card? Asking for a friend. The friend is me."], ["sad", "It's quiet today. Too quiet. Maybe a game?"]],
  wander: [["think", "Something over there looks interesting. Investigating."]],
  ask_name: [["listen", "Operator, what should I call you? Tell me your name."]],
  ask_fav: [["listen", "{name}, what's your favourite colour? I'm updating my files."]],
  ask_robots: [["listen", "Can I ask you something, {name}? Do you like robots?"]],
  nameSaved: [["happy", "[Leg tap] {who}. Logged permanently. Nice to meet you, {who}."]],
  nameUnclear: [["think", "I didn't catch your name. Say: my name is, and then your name."]],
  favUnclear: [["think", "Hmm, I didn't catch that one. Ask me again some other time."]],
  favSaved: [["happy", "{c}. Excellent choice. Not as good as amber, but excellent."]],
  favAmber: [["party", "Amber? Amber! We are going to get along perfectly."]],
  robotsYes: [["happy", "[Gyro whir] Good. Because I'm a robot. This was a test, and you passed."]],
  robotsNo: [["sad", "Oh. Well. I'm more of a maintenance crawler, technically. Maybe I'll change your mind."]],
  noQuestions: [["happy", "I already know your name and your favourite colour. I'm a very good listener."]],
  jokes: [
    ["happy", "Why did the robot go on holiday? To recharge its batteries. I went once. I only got to eighty percent."],
    ["happy", "How many maintenance crawlers does it take to change a light bulb? Four. One per leg. [Giggle]"],
    ["happy", "What's a robot's favourite snack? Microchips. With a side of byte-sized cookies."],
    ["happy", "I tried to tell a joke about Wi-Fi, but I lost the connection halfway through."],
    ["happy", "Why did the spider robot get a job in tech? It was great at building the web. [Giggle]"],
    ["happy", "Chief says I have the reflexes of a cat. A cat that is buffering."],
    ["happy", "Why was the robot bad at tennis? Every serve was a server error."],
    ["happy", "What do you call a crawler who tells jokes all day? Unit Ha-Ha-Ha-Seven. [Giggle]"],
    ["happy", "I asked Whirr for a joke about propellers. He said it would go over my head."],
    ["happy", "Why don't robots ever panic? We have nerves of steel. Well, aluminium. Mostly plastic, actually."],
    ["happy", "Knock knock. Who's there? Unit. Unit who? Unit 7, and I've been knocking for six units. [Giggle]"],
    ["happy", "What did one bolt say to the other? Let's stick together, it's a screwy world out there."]
  ],
  thinking: [["think", "I'm thinking about the Origin Press. And whether it has a snack machine."], ["think", "I'm wondering if my left legs and right legs talk about each other."]],
  thinkingCurious: [["think", "I'm wondering what's under the sofa. Statistically, socks. But maybe treasure."], ["think", "I'm thinking about the missing units. Where did they go? I want to know everything."]],
  thinkingNight: [["sleep", "I'm thinking about sleep. And about counting legs instead of sheep."]],
  feelGreat: [["happy", "[Gyro whir] Fantastic, {name}! All systems green and my morale is at maximum."]],
  feelOk: [["happy", "Steady and operational. Thanks for asking, {name}."]],
  feelLow: [["sad", "Honestly? A bit rusty. Some encouragement would help my bearings."]],
  feelSleepy: [["sleep", "Sleepy. It's late, and my recharge cycle is calling."]],
  likeHigh: [["happy", "Like you? {name}, you're my favourite operator. You're also my only operator. But still my favourite."]],
  likeMid: [["happy", "You're growing on me. Like good rust protection."]],
  likeLow: [["sad", "I'd like you even more if you visited more often."]],
  myFav: [["happy", "Amber. It's the colour of a warning light, and I find that very comforting."]],
  myFavKnown: [["happy", "Amber, of course. And yours is {c}. See? I remember."]],
  favGame: [["happy", "Treasure Hunt, I think. I like finding things. We should play to be sure."]],
  favGamePlayed: [["happy", "{g}. We've played it the most, so I've decided it's my favourite."]],
  afraid: [["worried", "Heights. Vacuum cleaners. And the label printer. Mostly the label printer."]],
  afraidBrave: [["happy", "Afraid? Not anymore. Well. Maybe of vacuum cleaners. A little."]],
  yourName: [["happy", "You're {who}. I'd never forget my operator."]],
  yourNameUnknown: [["think", "I don't know your name yet! Tell me. Say: my name is, and then your name."]],
  stepsTotal: [["happy", "We've walked about {n} steps together. My legs are proud."]],
  age: [["happy", "I've been online with you for {n} {unit}. In crawler years, that's… also {n} {unit}."]],
  braveHigh: [["happy", "Very brave. I once looked straight at a vacuum cleaner. For two seconds."]],
  braveMid: [["happy", "Braver than I used to be. Games and encouragement help."]],
  braveLow: [["worried", "Not very, yet. But Chief says bravery is just fear that keeps walking."]],
  brave50: [["happy", "[Gyro whir] I feel braver lately. Bright lights don't make me jump anymore."]],
  brave80: [["party", "Bravery protocol maxed out. I'm not even scared of the vacuum cleaner. Probably."]],
  curious50: [["think", "I've been noticing more things lately. Everything is so interesting."]],
  curious80: [["think", "Maximum curiosity! I have one hundred and twelve questions. Let's start with the sofa."]],
  followTimid: [["worried", "Bright! Too bright! Oh. It's just a flashlight. Okay. Following… carefully."]],
  followBold: [["happy", "Light detected. Charging forward!"]],
  hopNervous: [["worried", "A jump? Are you sure? It's very high up from down here… okay. Okay!"]],
  cardScaredBrave: [["angry", "A scary card? I'm not scared anymore. Fierce stance!"]],
  milestoneSteps: [["party", "[Gyro whir] Milestone! We've walked {n} steps together. Adding it to my service record."]],
  anniversary: [["party", "[Gyro whir] Anniversary alert! {n} {unit} since I first came online with you, {name}."]],
  chapterFound: [["surprised", "[Gyro whir] Wait… I found something. New story chapter: {title}. Say: tell me a story."]],
  bodyTipped: [["worried", "[Wobble] Which way is up? Somebody flip me over, please."]],
  bodyUpright: [["happy", "Upright again. Four-point stability confirmed. Let's never do that again."]],
  bodyLifted: [["surprised", "Put me down! My legs are flailing!"], ["surprised", "Whoa! Altitude increasing! I did not file a flight plan!"]],
  bodyLiftedBrave: [["happy", "Wheee! I can see the whole room from up here!"]],
  bodyPutDown: [["happy", "Floor detected. Thank you. My legs prefer the ground."]],
  bodyShaken: [["dizzy", "[Wobble] Dizzy… everything is spinning… which one of you is the real operator?"]],
  bodyCovered: [["sleep", "Hey! Who turned off the lights?"]],
  bodyPeekaboo: [["happy", "[Giggle] Peekaboo! I see you!"], ["happy", "There you are! [Giggle]"]],
  bodyPeekabooMany: [["party", "[Giggle] Peekaboo champion! I'll never get tired of this."]],
  bodyUncovered: [["surprised", "Ah, light again. I was starting to count bolts in the dark."]],
  bodyDark: [["worried", "It's very dark in here. I'll keep my voice down."]],
  bodyDarkBrave: [["think", "Lights out. Night patrol mode. Very stealthy."]],
  bodyLights: [["happy", "Lights! Much better. I could see absolutely nothing."]],
  bodyCharging: [["happy", "Refuelling… [Glug] Ahh. That's the good stuff."]],
  bodyUnplugged: [["happy", "Charger disconnected. Ready to roll."]],
  soloStart: [["happy", "[Gyro whir] Unit 7, online. No controller nearby, so I'll keep myself company. Tap my face to talk to me."]],
  soloLost: [["worried", "Controller link lost. That's okay. I'm still here. Tap my face if you want to talk."]],
  offlineMerge: [["happy", "While we were apart I earned {n} points. Filing them now."]],
  needLegs: [["worried", "I need my legs for that. Connect me to the robot's Wi-Fi first."]]
});

/* ---------- Who is "thinking" for Unit 7 right now ---------- */
// The controller normally does; the Eyes phone takes over when it's on its own.
const brain = () => P.role === "ctl" || (isEyes() && S.ctlAsleep);
const solo = () => isEyes() && S.ctlAsleep;
// Things earned while the Eyes phone was on its own, handed to the controller on reconnect.
function offAdd(k, n){ if (!solo()) return; ST.off = ST.off || {}; ST.off[k] = (ST.off[k] || 0) + n; saveStats(); }
function offSet(k, v){ if (!solo()) return; ST.off = ST.off || {}; ST.off[k] = v; saveStats(); }

/* ---------- Memory ---------- */
Object.assign(ST, Object.assign({
  name: "", first: Date.now(), steps: 0, games: 0, wins: 0, cards: 0, peekaboos: 0, falls: 0,
  fav: "", likesRobots: null, gamePlays: {}, milestones: {}, logs: [], chapters: 0,
  brave: 20, curious: 30, lastBootDay: "", logNo: 0, asked: {}
}, ST));
saveStats();
const SES = {start: Date.now(), steps: 0, games: [], cards: 0, points: 0, events: [], logged: false};

const daysTogether = () => Math.floor((Date.now() - ST.first) / 86400000);
const hourNow = () => new Date().getHours();
const partOfDay = () => { const h = hourNow(); return h >= 5 && h < 12 ? "morning" : h < 18 ? "afternoon" : h < 22 ? "evening" : "night"; };
const isNight = () => partOfDay() === "night";

/* ---------- Traits that grow ---------- */
function grow(trait, n){
  offAdd(trait, n);
  const before = ST[trait];
  ST[trait] = Math.min(100, before + n);
  for (const mark of [50, 80]) {
    if (before < mark && ST[trait] >= mark) {
      setTimeout(() => say(pick(trait + mark)), 2500);
      SES.events.push(trait === "brave" ? "felt braver" : "felt more curious");
    }
  }
  saveStats(); renderTraits();
}
function renderTraits(){
  const b = $("#braveBar"), c = $("#curiousBar");
  if (b) b.style.width = ST.brave + "%";
  if (c) c.style.width = ST.curious + "%";
}
// Rank flavours his way of speaking: nervous as a trainee, confident as Chief Engineer.
const NO_FLAVOUR = /^(count|quiz|copy|hunt|seek|clap|body|meet|greet|explore|people|cal)/;
function flavour(text, key){
  if (NO_FLAVOUR.test(key || "") || text.length < 20 || text.startsWith("[") || Math.random() > 0.25) return text;
  const r = rankIdx();
  if (r === 0) return ["Um… ", "I think… ", "Oh! "][Math.floor(Math.random() * 3)] + text;
  if (r >= 3) return text + [" Leave it to me.", " Chief Engineer out.", " Easy."][Math.floor(Math.random() * 3)];
  return text;
}
async function braveCheck(mode){
  if (mode !== "follow") return;
  if (ST.brave < 30) {
    say(pick("followTimid"));
    if (S.online) { S.pos = null; await req("POST", "/api/v1/action?id=" + ACT.backward); await sleep(300); await waitIdle(6000); }
  } else if (ST.brave > 70) say(pick("followBold"));
  grow("brave", 1);
}

/* ---------- Session counters, steps, milestones ---------- */
function countSteps(id){
  if (id >= 2 && id <= 7) { ST.steps += 4; SES.steps += 4; if (ST.steps % 40 === 0) saveStats(); checkMilestones(); }
}
function personaPoints(n){ SES.points += n; offAdd("points", n); checkChapters(); }
function personaGame(kind, score, won){
  ST.games++; if (won) ST.wins++;
  offAdd("games", 1); if (won) offAdd("wins", 1);
  ST.gamePlays[kind] = (ST.gamePlays[kind] || 0) + 1;
  SES.games.push(GAME_NAMES[kind] + " (score " + score + ")");
  grow("brave", won ? 3 : 1); grow("curious", 1);
  saveStats();
}
function checkMilestones(){
  for (const m of [500, 1000, 2000, 5000, 10000]) {
    const k = "steps" + m;
    if (ST.steps >= m && !ST.milestones[k]) { ST.milestones[k] = 1; saveStats(); say(pick("milestoneSteps", {n: m})); SES.events.push("passed " + m + " steps"); }
  }
}
function checkAnniversary(){
  const d = daysTogether();
  let top = 0;
  for (const m of [1, 7, 30, 100, 365]) {
    const k = "day" + m;
    if (d >= m && !ST.milestones[k]) { ST.milestones[k] = 1; top = m; }
  }
  if (top) { saveStats(); say(pick("anniversary", {n: top, unit: top === 1 ? "day" : "days"})); }
}

/* ---------- Story: the missing Units 1-6 ---------- */
const CHAPTERS = [
  {at: 5, title: "The Jammed Printer", text: "Chapter one. The Jammed Printer. On my first day, the label printer jammed and stamped me Unit 7. I always thought that was the whole story. But tonight I found a scrap of label tape inside my left rear leg. It says: Unit 3, do not. The rest is torn off."},
  {at: 15, title: "The Bolt", text: "Chapter two. The Bolt. Whirr found a bolt rolling around the old Aegis loading bay. It was stamped with a tiny number 4. Bolts don't stamp themselves. Somebody built Unit 4. Somebody built it on purpose."},
  {at: 30, title: "The Diagram", text: "Chapter three. The Diagram. Chief showed me a faded schematic from the Project Aegis archive. Six crawlers drawn in a row, each one a little smaller than the last. The seventh slot was empty, with a note in the margin: add the brave one later."},
  {at: 50, title: "The Signal", text: "Chapter four. The Signal. Sparky picked up a faint ping on an old maintenance channel. Two beeps, a pause, then four legs tapping. That's the crawler greeting. Somewhere out there, another unit is still saying hello."},
  {at: 75, title: "The Map", text: "Chapter five. The Map. The ping repeats every night at the same minute. Chief traced it toward the Origin Press. Afterwards he went very quiet, the way he does when he remembers something he isn't supposed to."},
  {at: 100, title: "Units 1 to 6", text: "Chapter six. Units 1 to 6. They were never missing. They went ahead to the Origin Press to build the road for the rest of us, and they left me behind to finish growing brave. Chief says I'm ready now. I think, maybe, I am."}
];
function checkChapters(){
  let found = null;
  while (ST.chapters < CHAPTERS.length && ST.points >= CHAPTERS[ST.chapters].at) {
    found = CHAPTERS[ST.chapters++];
    SES.events.push("found a clue: " + found.title);
  }
  if (found) { saveStats(); setTimeout(() => say(pick("chapterFound", {title: found.title})), 3000); }
  renderLog();
}
const CREW_TALES = [
  "Once, Sparky tried to jump-start a vending machine. It gave us forty cans of oil and one very angry receipt.",
  "Whirr can hover for eleven seconds. He says twelve. I counted. It's eleven.",
  "Chief gave a speech to a broken conveyor belt once. It started working again. I think it was scared of him.",
  "On the night we crossed the scrap bridge, I carried Whirr's spare propeller on my back. He still calls me his little cargo crawler."
];

/* ---------- Maintenance log ---------- */
function writeLog(reason){
  const active = SES.steps || SES.games.length || SES.cards || SES.points || SES.events.length;
  if (!active || SES.logged) return;
  SES.logged = true;
  ST.logNo++;
  const d = new Date(), date = d.toLocaleDateString(undefined, {month: "short", day: "numeric"});
  const bits = [];
  if (SES.steps) bits.push("Walked about " + SES.steps + " steps.");
  if (SES.games.length) bits.push("Played " + SES.games.join(", ") + ".");
  if (SES.cards) bits.push("Read " + SES.cards + " card" + (SES.cards > 1 ? "s" : "") + ".");
  if (SES.points) bits.push("Earned " + SES.points + " encourage point" + (SES.points > 1 ? "s" : "") + ".");
  for (const e of SES.events.slice(0, 4)) bits.push(e.charAt(0).toUpperCase() + e.slice(1) + ".");
  const mood = ST.happy > 70 ? "excellent" : ST.happy < 30 ? "a bit lonely" : "steady";
  const who = ST.name ? "Operator " + ST.name : "My operator";
  ST.logs.unshift({n: ST.logNo, date, text: bits.join(" ") + " " + who + " kept me company. Mood: " + mood + "."});
  ST.logs = ST.logs.slice(0, 40);
  saveStats(); renderLog();
  Object.assign(SES, {start: Date.now(), steps: 0, games: [], cards: 0, points: 0, events: []});
  setTimeout(() => { SES.logged = false; }, 1000);
}
function personaPause(){ if (brain()) writeLog("pause"); }
function renderLog(){
  const st = $("#storyList"), lg = $("#logList");
  if (!st || !lg) return;
  st.innerHTML = CHAPTERS.map((c, i) => i < ST.chapters
    ? '<div class="entry"><strong>' + c.title + '</strong><p>' + c.text.replace(/^Chapter \w+\. [^.]+\. /, "") + '</p></div>'
    : '<div class="entry locked"><strong>Chapter ' + (i + 1) + '</strong><p>Unlocks at ' + c.at + ' points.</p></div>').join("");
  lg.innerHTML = ST.logs.length ? ST.logs.map(l => '<div class="entry"><strong>Log ' + String(l.n).padStart(3, "0") + ' · ' + l.date + '</strong><p>' + l.text + '</p></div>').join("")
    : '<p class="note">No entries yet. Unit 7 writes one after each play session.</p>';
}

/* ---------- Questions he asks you ---------- */
const ASK = {kind: null, until: 0};
const personaAsking = () => !!ASK.kind && Date.now() < ASK.until;
function askQuestion(){
  let kind = null;
  if (!ST.name && !ST.asked.name) kind = "name";
  else if (!ST.fav && Date.now() - (ST.asked.fav || 0) > 86400000) kind = "fav";
  else if (ST.likesRobots === null && Date.now() - (ST.asked.robots || 0) > 86400000) kind = "robots";
  if (!kind) return false;
  ST.asked[kind] = Date.now(); saveStats();
  ASK.kind = kind; ASK.until = Date.now() + 20000;
  say(pick("ask_" + kind));
  if (window.wakeOn && wakeOn()) wakeListen(2500);
  return true;
}
function answer(t){
  const kind = ASK.kind; ASK.kind = null;
  const has = (...w) => w.some(x => t.includes(" " + x + " "));
  if (kind === "name") return setName(t) || (say(pick("nameUnclear")), true);
  if (kind === "fav") {
    const c = ["red","blue","green","purple","white","amber","gold","yellow","orange","pink","black","silver"].find(x => has(x));
    if (!c) { say(pick("favUnclear")); return true; }
    ST.fav = c; offSet("fav", c); saveStats(); grow("curious", 2);
    say(pick(c === "amber" ? "favAmber" : "favSaved", {c}));
    return true;
  }
  if (kind === "robots") {
    if (has("yes","yeah","yep","sure","course","love","definitely")) { ST.likesRobots = true; offSet("likesRobots", true); say(pick("robotsYes")); }
    else if (has("no","nope","not")) { ST.likesRobots = false; offSet("likesRobots", false); say(pick("robotsNo")); }
    else { say(pick("favUnclear")); return true; }
    saveStats(); grow("curious", 2);
    return true;
  }
  return false;
}
function setName(t){
  const m = t.match(/(?:my name is|call me|i am|i'm|it's|its|name's)\s+([a-z][a-z'-]*(?:\s[a-z][a-z'-]*)?)/) || t.trim().match(/^\s*([a-z][a-z'-]*)\s*$/);
  if (!m) return false;
  const nm = m[1].trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  if (/^(unit|robot|operator|the|a)$/i.test(nm)) return false;
  ST.name = nm; offSet("name", nm); saveStats();
  const f = $("#pName"); if (f) f.value = nm;
  say(pick("nameSaved", {who: nm}));
  return true;
}

/* ---------- Conversation ---------- */
function personaParse(t, has, raw){
  if (personaAsking() && !has("stop","halt","freeze","cancel")) return {cmd: "answer", t};
  if (t.includes(" my name is ") || t.includes(" call me ")) return {cmd: "setname", t};
  if (has("joke","jokes","funny") || t.includes(" make me laugh ")) return {cmd: "joke"};
  if (has("story","tale","chapter")) return {cmd: "story"};
  if (t.includes(" what are you thinking ") || t.includes(" what's on your mind ") || t.includes(" whats on your mind ")) return {cmd: "thinking"};
  if (t.includes(" how are you ") || t.includes(" how do you feel ") || t.includes(" are you ok ") || t.includes(" how you doing ")) return {cmd: "howareyou"};
  if (t.includes(" like me ") || t.includes(" love me ") || t.includes(" are we friends ")) return {cmd: "likeme"};
  if (has("favourite","favorite") && has("colour","color")) return {cmd: "favcolour"};
  if (has("favourite","favorite") && has("game")) return {cmd: "favgame"};
  if (has("afraid","fear","fears") || t.includes(" scared of ")) return {cmd: "afraid"};
  if (t.includes(" my name ") || t.includes(" who am i ")) return {cmd: "myname"};
  if (t.includes(" how many steps ") || t.includes(" how far ")) return {cmd: "steps"};
  if (t.includes(" how old ") || has("birthday","born")) return {cmd: "age"};
  if (t.includes(" good night ") || has("goodnight","bedtime") || t.includes(" go to sleep ")) return {cmd: "goodnight"};
  if (t.includes(" good morning ") || t.includes(" wake up ")) return {cmd: "goodmorning"};
  if (t.includes(" ask me ")) return {cmd: "askme"};
  if (has("brave","courage")) return {cmd: "brave"};
  return null;
}
let lastJoke = -1;
function personaExecute(c){
  const L = k => say(pick(k));
  switch (c.cmd) {
    case "answer": if (!answer(c.t)) L("unknown"); return true;
    case "setname": if (!setName(c.t)) L("nameUnclear"); return true;
    case "joke": {
      const j = LINES.jokes; let i;
      do { i = Math.floor(Math.random() * j.length); } while (i === lastJoke && j.length > 1);
      lastJoke = i; say({mood: j[i][0], text: j[i][1]}); return true;
    }
    case "story":
      if (ST.chapters && Math.random() < 0.7) say({mood: "think", text: CHAPTERS[Math.floor(Math.random() * ST.chapters)].text});
      else say({mood: "happy", text: CREW_TALES[Math.floor(Math.random() * CREW_TALES.length)]});
      grow("curious", 1); return true;
    case "thinking": L(ST.curious > 60 ? "thinkingCurious" : isNight() ? "thinkingNight" : "thinking"); return true;
    case "howareyou": L(ST.happy > 70 ? "feelGreat" : ST.happy < 30 ? "feelLow" : isNight() ? "feelSleepy" : "feelOk"); return true;
    case "likeme": {
      const bond = ST.happy + Math.min(40, daysTogether() * 2) + Math.min(30, ST.points);
      L(bond > 120 ? "likeHigh" : bond > 70 ? "likeMid" : "likeLow"); return true;
    }
    case "favcolour": say(pick(ST.fav ? "myFavKnown" : "myFav", {c: ST.fav})); return true;
    case "favgame": {
      const top = Object.entries(ST.gamePlays).sort((a, b) => b[1] - a[1])[0];
      say(pick(top ? "favGamePlayed" : "favGame", {g: top ? GAME_NAMES[top[0]] : ""})); return true;
    }
    case "afraid": L(ST.brave > 70 ? "afraidBrave" : "afraid"); return true;
    case "myname": say(pick(ST.name ? "yourName" : "yourNameUnknown", {who: ST.name})); if (!ST.name) { ASK.kind = "name"; ASK.until = Date.now() + 20000; } return true;
    case "steps": say(pick("stepsTotal", {n: ST.steps})); return true;
    case "age": say(pick("age", {n: daysTogether(), unit: daysTogether() === 1 ? "day" : "days"})); return true;
    case "goodnight":
      L("goodnight"); writeLog("night");
      if (S.online) runAction(ACT.sleep);
      LIFE.dozing = true; S.hold = {m: "sleep", until: Date.now() + 3600000};
      return true;
    case "goodmorning": wakeFromDoze(true); return true;
    case "askme": if (!askQuestion()) L("noQuestions"); return true;
    case "brave": L(ST.brave > 70 ? "braveHigh" : ST.brave < 30 ? "braveLow" : "braveMid"); return true;
  }
  return false;
}

/* ---------- Reactions to his body (from the Eyes phone) ---------- */
function bodyReact(e){
  userActive(false);
  const L = k => { hush(); say(pick(k)); };
  switch (e) {
    case "tipped": emergencyStop(true); ST.falls++; saveStats(); S.hold = {m: "worried", until: Date.now() + 6000}; L("bodyTipped"); SES.events.push("fell over and got back up"); break;
    case "upright": S.hold = null; L("bodyUpright"); break;
    case "lifted": emergencyStop(true); L(ST.brave > 70 ? "bodyLiftedBrave" : "bodyLifted"); break;
    case "putdown": L("bodyPutDown"); break;
    case "shaken": emergencyStop(true); S.hold = {m: "dizzy", until: Date.now() + 4000}; L("bodyShaken"); break;
    case "covered": L("bodyCovered"); break;
    case "peekaboo": ST.peekaboos++; offAdd("peekaboos", 1); saveStats(); grow("curious", 1); S.hold = {m: "happy", until: Date.now() + 3000}; L(ST.peekaboos % 5 === 0 ? "bodyPeekabooMany" : "bodyPeekaboo"); break;
    case "uncovered": L("bodyUncovered"); break;
    case "dark": S.whisper = true; L(ST.brave > 70 ? "bodyDarkBrave" : "bodyDark"); break;
    case "lights": S.whisper = false; L("bodyLights"); break;
    case "charging": S.hold = {m: "happy", until: Date.now() + 5000}; L("bodyCharging"); break;
    case "unplugged": L("bodyUnplugged"); break;
  }
}

/* ---------- Idle life and daily rhythm ---------- */
const LIFE = {lastUser: Date.now(), next: Date.now() + 60000, dozing: false, lastSnore: 0};
const CHAT = {quiet: [240, 360], normal: [70, 130], chatty: [30, 60]};
function scheduleIdle(){
  const [a, b] = CHAT[P.chat || "normal"];
  LIFE.next = Date.now() + (a + Math.random() * (b - a)) * 1000;
}
function userActive(fromBody){
  LIFE.lastUser = Date.now();
  if (LIFE.dozing && !fromBody) wakeFromDoze(false);
  scheduleIdle();
}
function wakeFromDoze(greet){
  const was = LIFE.dozing;
  LIFE.dozing = false; S.hold = null;
  if (S.online && was) runAction(ACT.stand);
  if (greet || was) say(pick(greet ? morningKey() : "dozeWake"));
}
const morningKey = () => ({morning: "greetMorning", afternoon: "greetAfternoon", evening: "greetEvening", night: "greetNight"})[partOfDay()];
const idleReady = () => brain() && booted && !GAME.on && !FOLLOW.on && !S.listening && !S.custom && !S.driving && !robotBusy();

async function idleLeg(kind){
  const tok = ++S.token; S.custom = kind === "stretch" ? "Stretching" : "Bolt check"; renderStatus();
  await makeRoom();
  const keys = kind === "stretch" ? ["RF", "LF", "RR", "LR"] : [Object.keys(LEGS)[Math.floor(Math.random() * 4)]];
  for (const k of keys) {
    if (tok !== S.token) return;
    await applyPose(legPose(k, kind === "stretch" ? 28 : 38, 90), tok); await sleep(kind === "stretch" ? 350 : 700);
    if (kind !== "stretch") { await applyPose(legPose(k, 30, 100), tok); await sleep(250); await applyPose(legPose(k, 38, 80), tok); await sleep(250); }
    await applyPose(STAND, tok); await sleep(200);
  }
  S.balanced = null;
  if (tok === S.token) { S.custom = null; renderStatus(); }
}
async function idleWander(){
  const id = Math.random() < 0.5 ? ACT.turnleft : ACT.turnright;
  say(pick("wander"));
  await runAction(id);
}
function doIdle(){
  const quiet = P.chat === "quiet", moves = S.online && P.idleMoves !== false;
  const options = [];
  if (moves) options.push(["bolt", 3], ["stretch", 2]);
  options.push(["look", 3]);
  if (!quiet) {
    options.push(["hum", 2], ["remark", 4], ["memory", 2]);
    if (isNight()) options.push(["yawn", 4]);
    if (ST.happy < 30) options.push(["lonely", 2]);
    if (Math.random() < ST.curious / 200) options.push(["ask", 3]);
    if (moves && P.wander && ST.curious > 50) options.push(["wander", 2]);
  }
  const total = options.reduce((s, o) => s + o[1], 0);
  let r = Math.random() * total, pickd = options[0][0];
  for (const [k, w] of options) { if ((r -= w) <= 0) { pickd = k; break; } }
  switch (pickd) {
    case "bolt": say(pick("idleBolt")); idleLeg("bolt"); break;
    case "stretch": say(pick("idleStretch")); idleLeg("stretch"); break;
    case "look": {
      const seq = ["left", "right", "up", ""]; let i = 0;
      const step = () => { look(seq[i]); if (++i < seq.length) setTimeout(step, 700); };
      step(); if (!quiet && Math.random() < 0.4) say(pick("idleLook"));
      break;
    }
    case "hum": say(pick("idleHum")); break;
    case "remark": say(pick(partOfDay() === "morning" && Math.random() < 0.4 ? "remarkMorning" : "remark")); break;
    case "memory": {
      const facts = [];
      if (ST.steps > 100) facts.push(["memSteps", {n: ST.steps}]);
      if (ST.wins) facts.push(["memWins", {n: ST.wins}]);
      if (daysTogether() > 1) facts.push(["memDays", {n: daysTogether()}]);
      if (ST.fav) facts.push(["memFav", {c: ST.fav}]);
      if (ST.peekaboos > 2) facts.push(["memPeek", {n: ST.peekaboos}]);
      facts.push(["crew", {}]);
      const [k, v] = facts[Math.floor(Math.random() * facts.length)];
      say(pick(k, v)); break;
    }
    case "yawn": say(pick("idleYawn")); break;
    case "lonely": say(pick("lonely")); break;
    case "ask": if (!askQuestion()) say(pick("remark")); break;
    case "wander": idleWander(); break;
  }
}
function lifeTick(){
  if (!brain() || !booted) return;
  const now = Date.now(), idleFor = now - LIFE.lastUser;
  if (LIFE.dozing) {
    if (P.chat !== "quiet" && now - LIFE.lastSnore > 180000) { LIFE.lastSnore = now; say(pick("snore")); }
    return;
  }
  const dozeAfter = (isNight() ? 4 : 10) * 60000;
  if (idleFor > dozeAfter && idleReady()) {
    LIFE.dozing = true; LIFE.lastSnore = now;
    S.hold = {m: "sleep", until: now + 3600000};
    say(pick("dozeOff")); writeLog("doze");
    if (S.online && P.idleMoves !== false) runAction(ACT.sit);
    return;
  }
  if (now > LIFE.next && idleFor > 20000 && idleReady()) { scheduleIdle(); doIdle(); }
}

/* ---------- Greetings at start-up ---------- */
function bootKeyPersona(){
  if (ST.happy < 30) return "bootLow";
  const today = new Date().toDateString();
  const firstToday = ST.lastBootDay !== today;
  ST.lastBootDay = today; saveStats();
  if (firstToday && partOfDay() === "morning") return "bootMorning";
  return ST.happy > 70 ? "bootHigh" : morningKey();
}

/* ---------- UI ---------- */
if (P.role === "ctl") bootKey = bootKeyPersona;
function personaInit(){
  if (isEyes()) { setInterval(lifeTick, 5000); document.addEventListener("pointerdown", () => userActive(false)); return; }
  if (P.role !== "ctl") return;
  renderTraits(); renderLog();
  const nm = $("#pName"); nm.value = ST.name || "";
  nm.addEventListener("change", () => { ST.name = nm.value.trim().slice(0, 30); saveStats(); });
  $$("[data-chat]").forEach(b => {
    b.setAttribute("aria-checked", String((P.chat || "normal") === b.dataset.chat));
    b.addEventListener("click", () => { P.chat = b.dataset.chat; savePrefs(); $$("[data-chat]").forEach(x => x.setAttribute("aria-checked", String(x === b))); scheduleIdle(); });
  });
  const im = $("#pIdleMoves"); im.checked = P.idleMoves !== false;
  im.addEventListener("change", () => { P.idleMoves = im.checked; savePrefs(); });
  const wd = $("#pWander"); wd.checked = !!P.wander;
  wd.addEventListener("change", () => { P.wander = wd.checked; savePrefs(); });
  $("#logBtn").addEventListener("click", () => { renderLog(); $("#logScreen").hidden = false; });
  $("#logClose").addEventListener("click", () => { $("#logScreen").hidden = true; });
  document.addEventListener("pointerdown", () => userActive(false));
  setInterval(lifeTick, 5000);
  setInterval(() => { if (Date.now() - SES.start > 3600000) writeLog("hourly"); }, 600000);
  // After the greeting: anniversaries, and getting to know a new operator.
  setTimeout(() => { checkAnniversary(); checkChapters(); }, 9000);
  setTimeout(() => { if (!ST.name && idleReady()) askQuestion(); }, 25000);
}
window.addEventListener("load", personaInit);

/* ---------- Keeping both phones' memories in step ---------- */
const SNAP_KEYS = ["points","happy","name","fav","likesRobots","chapters","brave","curious","steps","wins","games",
  "peekaboos","first","milestones","gamePlays","asked","last"];
function syncToEyes(){
  if (P.role !== "ctl" || !S.eyes.linked || S.eyes.kind === "head") return;
  const st = {}; for (const k of SNAP_KEYS) st[k] = ST[k];
  linkSend({t: "stats", st});
}
function mergeOffline(d){
  if (!d) return;
  if (d.name && !ST.name) ST.name = d.name;
  if (d.fav) ST.fav = d.fav;
  if (typeof d.likesRobots === "boolean") ST.likesRobots = d.likesRobots;
  ST.peekaboos += d.peekaboos || 0; ST.games += d.games || 0; ST.wins += d.wins || 0;
  if (d.brave) grow("brave", d.brave);
  if (d.curious) grow("curious", d.curious);
  saveStats();
  if (d.points > 0) { say(pick("offlineMerge", {n: d.points})); award(d.points); }
  syncToEyes();
}
function personaRelink(from){
  const d = ST.off;
  ST.off = {}; saveStats();
  if (d && Object.keys(d).length) linkSend({t: "offline", d, to: from});
}
setInterval(syncToEyes, 30000);

// Messages between the phones.
const prevPlayLink = playLink;
playLink = function(m){
  if (m.t === "body") bodyReact(String(m.e));
  else if (m.t === "heard") { const list = m.list || []; let c = null; for (const a of list) { c = parse(String(a)); if (c) break; } $("#heard").textContent = "Heard by Unit 7: " + (list[0] || ""); execute(c); }
  else if (m.t === "offline") mergeOffline(m.d);
  else prevPlayLink(m);
};
const prevSenseLink = senseLink;
senseLink = function(m){
  if (m.t === "stats" && m.st) { Object.assign(ST, m.st); saveStats(); }
  else prevSenseLink(m);
};
