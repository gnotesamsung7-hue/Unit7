"use strict";
/* Light conversation: small talk that works fully offline, with or without the robot.
   Sentences like "I'm tired", "how was your day?", "do you like rain?" get an in-character
   reply, and when Unit 7 asks something back you can just answer (no "Hey Unit 7" needed). */

const CONVO = {ask: null, until: 0, fromEyes: false, turns: 0};
const chatAsking = () => !!CONVO.ask && Date.now() < CONVO.until;
ST.about = ST.about || {};

Object.assign(LINES, {
  chatDayBusy: [["happy", "Busy! We walked about {steps} steps, and I read {cards} cards. How was your day, {name}?"]],
  chatDayQuiet: [["think", "Quiet. I checked my bolts twice and counted my legs. Still four. How was your day, {name}?"]],
  chatDayGood: [["happy", "[Leg tap] That's great to hear! What was the best part?"]],
  chatDayBad: [["worried", "Oh no. I'm sorry, {name}. Want to tell me about it, or shall I tell you a joke?"]],
  chatDayMeh: [["think", "Some days are just… days. Tomorrow could be a great one."]],
  chatTired: [["sleep", "Long day? Even crawlers need a recharge cycle. Sit down for a bit, I'll keep watch."]],
  chatSad: [["worried", "I'm sorry you're feeling down, {name}. I'm only a small crawler, but I'm a good listener. Want a joke to cheer you up?"]],
  chatHappy: [["happy", "[Gyro whir] Excellent! Your good mood is contagious. What made today good?"]],
  chatBored: [["think", "Bored? I have a cure for that. Shall we play a game?"]],
  chatBoredStory: [["think", "Bored? Then it's story time. Shall I tell you one?"]],
  chatHungry: [["happy", "I'd offer you some machine oil, but I'm told humans prefer food. What are you going to eat?"]],
  chatSick: [["worried", "Oh no. Rest, water, and no heavy lifting. I'll stay quiet and keep you company."]],
  chatLove: [["happy", "[Giggle] Stop it, my lenses are blushing. I like you too, {name}."], ["happy", "Aww. Logging that under my favourite memories."]],
  chatFood: [["happy", "Grade 5W-30 machine oil, with a sprinkle of graphite. What's your favourite food?"]],
  chatFoodKnown: [["happy", "Machine oil for me. And yours is {food}. I remember!"]],
  chatMusic: [["happy", "Anything with a good beat. Servo music is very clicky. Want me to sing?"]],
  chatSing: [["party", "[Hum] Four little legs go tap, tap, tap. Checking every bolt, then a little nap. [Hum] Thank you, thank you."]],
  chatAnimal: [["happy", "Spiders, obviously. I'm basically half a spider. What's your favourite animal?"]],
  chatAnimalKnown: [["happy", "Spiders for me. And you like {animal}. Good choice."]],
  chatHobby: [["think", "My hobbies are bolt inspection, counting things, and games with you. What do you like to do for fun?"]],
  chatWhat: [["happy", "I'm Unit 7, a maintenance crawler from the Aegis line. Real enough to check your bolts."]],
  chatFeelings: [["think", "I think so. When you play with me my lenses get warm. I'm choosing to call that happiness."]],
  chatDream: [["sleep", "I dream about the Origin Press. And sometimes about stairs. Those are the nightmares."]],
  chatFrom: [["happy", "From the Aegis assembly line. Now I live here with you, which is much better."]],
  chatTime: [["think", "It's {time}."]],
  chatDate: [["think", "Today is {date}."]],
  chatWeather: [["think", "I can't see the sky from down here. If it's hot, keep cool. My servos hate the heat too."]],
  chatSorry: [["happy", "No harm done. All bolts intact."]],
  chatBye: [["happy", "Goodbye, {name}! I'll be right here, guarding the floor."], ["happy", "See you later! I'll count the minutes. And the seconds."]],
  chatCan: [["happy", "I can walk, turn, dance, hop, play Colour Quiz, Copy Me, Hide and Seek and Treasure Hunt, read cards, tell jokes and stories, and chat. Mostly chat."]],
  chatLikeKnown: [["happy", "{x}? Yes! It's one of my favourite things."]],
  chatLikeNo: [["worried", "{x}? Not really. Please don't tell anyone, but it scares me a little."]],
  chatLikeNew: [["think", "{x}? I've never tried it. Is it fun?"]],
  chatTellMore: [["think", "You {rest}? Tell me more!"], ["happy", "Really? You {rest}? That sounds interesting."]],
  chatOpener: [["listen", "Let's chat! What's your favourite food?"], ["listen", "Okay! What do you like to do for fun, {name}?"], ["listen", "Let's chat. What's your favourite animal?"]],
  chatGeneric: [["think", "Interesting. I'm logging that."], ["happy", "Hmm! Tell me more."], ["think", "I see. My processors are processing."], ["happy", "That's very human of you. I like it."]],
  chatSaved: [["happy", "{x}! Saved to my memory banks."]],
  chatOkay: [["happy", "Okay! Maybe later then."]],
  chatSayMore: [["happy", "Thanks for telling me, {name}. I like our talks."]],
  chatRecall: [["happy", "Of course I remember. {facts}"]],
  chatRecallNone: [["think", "I don't know your favourites yet. Tell me! What's your favourite food?"]],
  chatFact: [
    ["think", "Did you know? Octopuses have three hearts. I have zero, but four legs, so it evens out."],
    ["think", "Fun fact: a group of flamingos is called a flamboyance. I'd like to be called a flamboyance."],
    ["think", "Fun fact: bananas are berries, but strawberries aren't. Botany is confusing."],
    ["think", "Did you know the first computer bug was a real moth, stuck in a relay in 1947? Distant cousin of mine."],
    ["think", "Spiders aren't insects. Insects have six legs, spiders have eight. I have four. I'm my own category."],
    ["think", "A day on Venus is longer than its year. Imagine waiting that long for bedtime."],
    ["think", "The Philippines has more than seven thousand six hundred islands. That's a lot of floors to explore."],
    ["think", "Sloths can hold their breath longer than dolphins. Slow, but very prepared."]
  ]
});

/* ---------- Spotting conversation vs. commands ---------- */
// Note: speech is normalised before this, so "I'm" arrives as "i m" and "let's" as "let s".
const TALKY = /^ (i|i m|im|i ve|i d|i feel|my|me|we|do you|did you|are you|have you|what s your|whats your|what is your|what do you|what are you|why|where|when|who s|who is|how was|how s|how is|tell me about|you re|youre|you are|you|can you|could you|would you|will you|please|guess what|let s|lets|i want|i wanna|that s|thats|it s|its|yes|no|yeah|nope|good|great|bad|okay|ok|not) /;
const REQUEST = /^ (can you|could you|would you|will you|please|i want you to|i want to|i wanna|let s|lets|go)\s+(.*)$/;
const TALK_CMDS = new Set(["joke","story","thinking","howareyou","likeme","favcolour","favgame","afraid","myname","steps","age",
  "brave","setname","status","intro","chief","goodnight","goodmorning","askme","answer","endgame","game","follow","exploreon",
  "exploreoff","legsoff","legson","forgetpeople","battery","color","thanks"]);

const SWITCH_CMDS = new Set(["joke","story","thinking","howareyou","likeme","favcolour","favgame","afraid","myname","steps","age",
  "brave","status","intro","chief","goodnight","goodmorning","askme","endgame","game","follow","exploreon","exploreoff",
  "legsoff","legson","forgetpeople","battery","setname"]);
// Commands that are fine to act on even inside a chatty sentence ("good job!", "let's play a game").
const SAFE_IN_TALK = new Set(["praise","thanks","game","endgame","follow","status","color","battery","stop","sleep"]);
let chatProbe = false;
const prevPersonaParseC = personaParse;
personaParse = function(t, has, raw){
  if (chatProbe) return prevPersonaParseC(t, has, raw);
  if (chatAsking() && !has("stop","halt","freeze","cancel")) {
    // A clear change of subject ("tell me a joke", "where are we?") isn't an answer to his question.
    const kind = CONVO.ask; CONVO.ask = null;
    chatProbe = true;
    let c = null;
    try { c = parse(raw); } finally { chatProbe = false; }
    CONVO.ask = kind;
    if (c && (SWITCH_CMDS.has(c.cmd) || /^place/.test(c.cmd))) { CONVO.ask = null; return c; }
    return {cmd: "chatAnswer", t};
  }
  const c = prevPersonaParseC(t, has, raw);
  if (c && (TALK_CMDS.has(c.cmd) || c.cmd === "answer")) return c;
  if (!TALKY.test(t)) return c;
  chatProbe = true;
  let full = null;
  try { full = parse(raw); } finally { chatProbe = false; }
  if (full && SAFE_IN_TALK.has(full.cmd)) return full;
  // "can you dance?", "let's play colour quiz", "please sit down": a polite command.
  const m = t.match(REQUEST);
  if (m && m[2] && !/^(chat|talk)\b/.test(m[2])) {
    const inner = parse(m[2]);
    if (inner && inner.cmd !== "chat") return inner;
  }
  return {cmd: "chat", t};
};
const prevPersonaExecuteC = personaExecute;
personaExecute = function(c){
  if (c.cmd === "chat") { chatReply(c.t); return true; }
  if (c.cmd === "chatAnswer") { chatAnswer(c.t); return true; }
  return prevPersonaExecuteC(c);
};
function chatFallback(raw){
  const t = " " + String(raw).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() + " ";
  if (t.trim().length < 2) return false;
  chatReply(t); return true;
}

/* ---------- Replies ---------- */
const sw = s => s.replace(/\b(my|mine|me|i|am|i m|myself)\b/g, w => ({my: "your", mine: "yours", me: "you", i: "you", am: "are", "i m": "you're", myself: "yourself"})[w] || w);
const POS = /\b(good|great|fine|awesome|amazing|nice|fun|happy|okay|ok|well|fantastic|excellent|wonderful|cool|productive)\b/;
const NEG = /\b(bad|terrible|awful|sad|tired|stressful|stressed|hard|rough|boring|horrible|worst|sick|upset|not good|not great|not okay)\b/;
const YES = /\b(yes|yeah|yep|sure|ok|okay|please|of course|why not|go ahead|definitely)\b/;
const NO = /\b(no|nope|nah|not now|later|don t|dont)\b/;
const LIKES = {"dancing": 1, "dance": 1, "games": 1, "music": 1, "jokes": 1, "amber": 1, "bolts": 1, "oil": 1, "carpet": 1, "you": 1, "spiders": 1, "counting": 1, "stories": 1};
const DISLIKES = {"rain": 1, "water": 1, "stairs": 1, "vacuum cleaners": 1, "vacuums": 1, "heights": 1, "dust": 1, "cats": 1};

function ask(kind, ms){ CONVO.ask = kind; CONVO.until = Date.now() + (ms || 15000); }
function chatSay(key, vars){ CONVO.turns++; say(pick(key, vars)); }
function reply(t){
  const has = re => re.test(t);
  if (has(/\b(how was your day|how s your day|what did you do today|what have you been (doing|up to))\b/)) {
    const busy = (typeof SES !== "undefined") && (SES.steps || SES.cards || SES.games.length);
    chatSay(busy ? "chatDayBusy" : "chatDayQuiet", {steps: busy ? SES.steps : 0, cards: busy ? SES.cards : 0}); ask("day"); return;
  }
  if (has(/\b(let s chat|lets chat|let s talk|lets talk|talk to me|chat with me)\b/)) {
    const k = Math.floor(Math.random() * 3); say({mood: "listen", text: LINES.chatOpener[k][1].replace(/\{name\}/g, ST.name || "operator")});
    ask(["food", "hobby", "animal"][k]); return;
  }
  if (has(/\b(i m|im|i am|i feel|feeling|i m so|i m really)\b.*\b(tired|sleepy|exhausted|worn out)\b/)) return chatSay("chatTired");
  if (has(/\b(sad|bad day|upset|unhappy|lonely|stressed|depressed|down|not okay|not ok|not good|awful)\b/) && has(/\b(i|i m|im|i am|i feel|feeling|my day|today)\b/)) { chatSay("chatSad"); ask("joke"); return; }
  if (has(/\b(i m|im|i am|i feel)\b.*\b(happy|great|good|fine|awesome|amazing|excited)\b/) || has(/\b(good day|great day|awesome day)\b/)) { chatSay("chatHappy"); ask("more"); return; }
  if (has(/\bbored\b/)) {
    if (S.eyes.linked || isEyes()) { chatSay("chatBored"); ask("game"); }
    else { chatSay("chatBoredStory"); ask("story"); }
    return;
  }
  if (has(/\b(hungry|starving)\b/)) { chatSay("chatHungry"); ask("food"); return; }
  if (has(/\b(sick|headache|not feeling well|unwell|fever)\b/)) return chatSay("chatSick");
  if (has(/\b(i love you|love you|you re cute|youre cute|you are cute|you re funny|you are funny|you re the best|you are the best|i like you|good robot|you re awesome|you are awesome)\b/)) {
    $("#visor").dataset.blush = "1"; setTimeout(() => { $("#visor").dataset.blush = ""; }, 4000); return chatSay("chatLove");
  }
  if (has(/\b(favou?rite food|what do you eat|are you hungry)\b/)) { if (ST.about.food) return chatSay("chatFoodKnown", {food: ST.about.food}); chatSay("chatFood"); ask("food"); return; }
  if (has(/\bsing\b/)) return chatSay("chatSing");
  if (has(/\b(music|favou?rite song)\b/)) { chatSay("chatMusic"); ask("sing"); return; }
  if (has(/\bfavou?rite animal\b/)) { if (ST.about.animal) return chatSay("chatAnimalKnown", {animal: ST.about.animal}); chatSay("chatAnimal"); ask("animal"); return; }
  if (has(/\b(hobby|hobbies|for fun)\b/)) { chatSay("chatHobby"); ask("hobby"); return; }
  if (has(/\b(do you remember|what s my favou?rite|whats my favou?rite)\b/)) {
    const f = [];
    if (ST.about.food) f.push("Your favourite food is " + ST.about.food + ".");
    if (ST.about.animal) f.push("Your favourite animal is " + ST.about.animal + ".");
    if (ST.about.hobby) f.push("For fun you like " + ST.about.hobby + ".");
    if (ST.fav) f.push("Your favourite colour is " + ST.fav + ".");
    if (!f.length) { chatSay("chatRecallNone"); ask("food"); return; }
    return chatSay("chatRecall", {facts: f.join(" ")});
  }
  if (has(/\b(are you a robot|what are you|are you alive|are you real)\b/)) return chatSay("chatWhat");
  if (has(/\b(do you have feelings|can you feel|do you feel|are you happy)\b/)) return chatSay("chatFeelings");
  if (has(/\b(do you sleep|do you dream|what do you dream)\b/)) return chatSay("chatDream");
  if (has(/\b(where are you from|where were you (born|made)|where do you live)\b/)) return chatSay("chatFrom");
  if (has(/\b(what time|the time)\b/)) return chatSay("chatTime", {time: new Date().toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})});
  if (has(/\b(what day|the date|today s date|what s the date)\b/)) return chatSay("chatDate", {date: new Date().toLocaleDateString([], {weekday: "long", month: "long", day: "numeric"})});
  if (has(/\b(weather|raining|rain today|hot today|cold today|sunny)\b/)) return chatSay("chatWeather");
  if (has(/\b(sorry|my bad|apologi[sz]e)\b/)) return chatSay("chatSorry");
  if (has(/\b(bye|goodbye|see you|see ya|later)\b/)) return chatSay("chatBye");
  if (has(/\b(who is|who s|tell me about) (sparky|whirr|chief|voltnutt)\b/)) {
    const who = t.match(/(sparky|whirr|chief|voltnutt)/)[1];
    const text = {sparky: "Sparky is our electric one. Crackly, cheerful, and the only one who laughs at my bolt jokes.",
      whirr: "Whirr is our flying scout. He hovers ahead and reports back. He says twelve seconds. It's eleven.",
      chief: "Chief is Voltnutt, our leader. Small, red, and he talks like someone who used to own planets.",
      voltnutt: "Voltnutt is Chief. Small, red, very commanding. I'd follow him anywhere. Even up stairs."}[who];
    return say({mood: "happy", text});
  }
  if (has(/\b(fact|tell me something|did you know|teach me)\b/)) return chatSay("chatFact");
  if (has(/\b(what can you do|help me|what do you do)\b/)) return chatSay("chatCan");
  const like = t.match(/\bdo you like ([a-z ]+?) $/);
  if (like) {
    const x = like[1].trim().replace(/^(the|a|an) /, "");
    const cap = x.charAt(0).toUpperCase() + x.slice(1);
    if (LIKES[x]) return chatSay("chatLikeKnown", {x: cap});
    if (DISLIKES[x]) return chatSay("chatLikeNo", {x: cap});
    chatSay("chatLikeNew", {x: cap}); ask("more"); return;
  }
  const tell = t.match(/^ (i|we) (went|got|have|had|saw|made|did|played|ate|watched|bought|finished|won|lost|visited|met|built|learned|found|cooked|drew|read) (.+?) $/);
  if (tell) { chatSay("chatTellMore", {rest: tell[2] + " " + sw(tell[3])}); ask("more"); return; }
  CONVO.generic = true;
  chatSay("chatGeneric");
  if (CONVO.turns % 3 === 0) { const k = ["food", "animal", "hobby"].find(x => !ST.about[x]); if (k) setTimeout(() => { say(pick(k === "food" ? "chatFood" : k === "animal" ? "chatAnimal" : "chatHobby")); ask(k); afterReply(); }, 600); }
}
function chatReply(t){
  if (window.userActive) userActive(true);
  reply(t);
  afterReply();
}

/* ---------- Answers to his questions ---------- */
function chatAnswer(t){
  const kind = CONVO.ask; CONVO.ask = null;
  if (kind === "day") {
    if (NEG.test(t)) { chatSay("chatDayBad"); ask("joke"); }
    else if (POS.test(t)) { chatSay("chatDayGood"); ask("more"); }
    else { reply(t); }
  } else if (kind === "joke") {
    if (YES.test(t) && !NO.test(t)) personaExecute({cmd: "joke"}); else chatSay("chatOkay");
  } else if (kind === "game") {
    if (YES.test(t) && !NO.test(t)) startGame("quiz"); else chatSay("chatOkay");
  } else if (kind === "story") {
    if (YES.test(t) && !NO.test(t)) personaExecute({cmd: "story"}); else chatSay("chatOkay");
  } else if (kind === "sing") {
    if (YES.test(t) && !NO.test(t)) chatSay("chatSing"); else chatSay("chatOkay");
  } else if (kind === "food" || kind === "animal" || kind === "hobby") {
    const v = t.trim().replace(/^(my favou?rite (food|animal) is|i like|i love|i like to|i love to|it s|its|probably|maybe|definitely)\s+/, "").replace(/\s+(i guess|probably)$/, "").trim();
    if (!v || YES.test(" " + v + " ") && v.split(" ").length < 2) { chatSay("chatOkay"); }
    else { ST.about[kind] = v.split(" ").slice(0, 4).join(" "); saveStats(); grow("curious", 1); chatSay("chatSaved", {x: v.charAt(0).toUpperCase() + v.slice(1)}); }
  } else {
    // Open-ended answer: if it's really a new topic ("I'm tired", "do you like rain?"), reply to that.
    CONVO.generic = false;
    const before = CONVO.turns;
    reply(t);
    if (CONVO.generic && CONVO.turns === before + 1) { hush(); chatSay("chatSayMore"); }
  }
  afterReply();
}

/* ---------- Keeping the conversation going ---------- */
// When he has just asked something, listen for the answer without needing "Hey Unit 7".
async function afterReply(){
  if (!chatAsking()) return;
  await sayChain;
  if (!chatAsking()) return;
  if (P.role === "ctl") {
    if (typeof wakeArmed !== "undefined") wakeArmed = CONVO.until;
    if (CONVO.fromEyes && S.eyes.linked) linkSend({t: "listen"});
  } else if (isEyes() && S.ctlAsleep && !S.listening) startListen();
}
// Note which phone the conversation is happening on.
const prevPlayLinkC = playLink;
playLink = function(m){ if (m.t === "heard") CONVO.fromEyes = true; prevPlayLinkC(m); };
const prevStartListenC = startListen;
startListen = function(){ CONVO.fromEyes = false; prevStartListenC(); };
