"use strict";
/* No-leg mode: Unit 7 without a robot body. He chats, plays card games, reacts and
   acts his moves out on screen. Choose it in Setup, or say "Hey Unit 7, no-leg mode". */

Object.assign(LINES, {
  noLegOn: [["happy", "[Gyro whir] No-leg mode. My legs are off duty, but I'm all ears. And lenses."]],
  noLegOff: [["happy", "[Leg tap] Legs back online. Four of them. I counted."]],
  pretendHop: [["surprised", "Hop! Well. My eyes hopped. That counts."], ["surprised", "Imaginary jump! Very high. You should have seen it."]],
  noLegWave: [["happy", "[Leg tap] Hello! I'm waving with my lenses, since my legs are off duty."]],
  pretendWalk: [["happy", "Imaginary walking. One, two, three. Very convincing, right?"]],
  followEyes: [["think", "I can't walk right now, but my eyes will follow your light."]],
  seekNoLegs: [["happy", "No-leg Hide and Seek! Hide somewhere I can see, keep your flashlight on, and I'll spot you with my eyes. Counting to ten."]]
});

function setBody(body, announce){
  if (P.body === body) return;
  P.body = body; savePrefs();
  if (FOLLOW.on) FOLLOW.on = false;
  if (body === "none") { S.online = false; $("#dot").classList.remove("on"); if (S.tab === "pilot" || S.tab === "legs") showTab("home"); }
  renderBody(); renderStatus();
  if (P.role === "ctl" && S.eyes.linked) linkSend({t: "legs", none: body === "none"});
  if (announce) say(pick(body === "none" ? "noLegOn" : "noLegOff"));
  if (body !== "none") refreshState();
}
function renderBody(){
  const none = noLegs();
  $$('nav [data-tab="pilot"], nav [data-tab="legs"]').forEach(b => { b.hidden = none; });
  $$("[data-body]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.body === P.body)));
  $("#robotSection").hidden = none;
  $("#bodyNote").textContent = none
    ? "No robot needed. He talks, plays card games, reacts to the Palm's sensors and acts his moves out on screen."
    : "Unit 7 drives the LAFVIN spider robot over its Wi-Fi.";
}

// Voice: "no-leg mode" / "legs on"
const prevPersonaParseN = personaParse;
personaParse = function(t, has, raw){
  if ((has("no","without","off") && has("leg","legs")) || t.includes(" no leg ") || t.includes(" no-leg ") || t.includes(" noleg ")) return {cmd: "legsoff"};
  if ((has("legs","leg") && has("on","back")) || t.includes(" spider mode ")) return {cmd: "legson"};
  return prevPersonaParseN(t, has, raw);
};
const prevPersonaExecuteN = personaExecute;
personaExecute = function(c){
  if (c.cmd === "legsoff") { if (noLegs()) say(pick("noLegOn")); else setBody("none", true); return true; }
  if (c.cmd === "legson") { if (!noLegs()) say(pick("noLegOff")); else setBody("spider", true); return true; }
  if (noLegs() && c.cmd === "wave") { say(pick("noLegWave")); actVisual("wave"); return true; }
  // Walking with no legs: a bit of humour before acting it out.
  if (noLegs() && ["forward","backward","turnleft","turnright","stepleft","stepright"].includes(c.cmd) && Math.random() < 0.5) {
    say(pick("pretendWalk")); walkSteps(ACT[c.cmd], c.n || 3, "Pretend walking"); return true;
  }
  return prevPersonaExecuteN(c);
};

// Keep the Eyes phone in step, so it doesn't complain about missing legs either.
const prevSenseLinkN = senseLink;
senseLink = function(m){
  if (m.t === "legs") { P.body = m.none ? "none" : "spider"; savePrefs(); return; }
  prevSenseLinkN(m);
};
const prevSyncN = syncToEyes;
syncToEyes = function(){ prevSyncN(); if (P.role === "ctl" && S.eyes.linked) linkSend({t: "legs", none: noLegs()}); };

window.addEventListener("load", () => {
  renderBody();
  $$("[data-body]").forEach(b => b.addEventListener("click", () => setBody(b.dataset.body, true)));
});
