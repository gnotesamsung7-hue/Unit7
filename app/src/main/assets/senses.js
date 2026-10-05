"use strict";
/* Eyes phone senses: hand waves and bright light (camera), claps (microphone).
   Results go to the controller phone, which decides what Unit 7 does. */

const SENSE = {follow:false, game:false, prev:null, hist:[], lastWave:0, quietUntil:0, lastLightSent:0};

// Analyse a small grayscale frame. Pure function so it can be tested.
function analyzeFrame(lum, prev, w, h){
  const n = w * h;
  let mean = 0, max = 0;
  for (let i = 0; i < n; i++) { mean += lum[i]; if (lum[i] > max) max = lum[i]; }
  mean /= n;
  // Motion: pixels that changed a lot since the last frame.
  let mc = 0, sx = 0;
  if (prev) for (let i = 0; i < n; i++) if (Math.abs(lum[i] - prev[i]) > 28) { mc++; sx += i % w; }
  const motion = mc / n, cx = mc ? (sx / mc) / w * 2 - 1 : 0;
  // Light: a small, very bright patch that stands out from the room.
  const seen = max > 215 && max - mean > 60;
  let bc = 0, bx = 0;
  if (seen) {
    const cut = Math.max(200, max - 25);
    for (let i = 0; i < n; i++) if (lum[i] >= cut) { bc++; bx += i % w; }
  }
  return {motion, cx, mean, light: {seen, x: bc ? +((bx / bc) / w * 2 - 1).toFixed(2) : 0, area: +(bc / n).toFixed(3)}};
}

// A wave = a moving patch that swings left-right-left while the rest of the picture stays still.
function waveTick(r, now){
  const H = SENSE.hist;
  if (r.motion > 0.35) { H.length = 0; return false; }      // whole picture moving: robot walking or bumped
  if (r.motion > 0.015) H.push({t: now, cx: r.cx});
  while (H.length && now - H[0].t > 1800) H.shift();
  if (H.length < 5) return false;
  let rev = 0, dir = 0, minx = 1, maxx = -1;
  for (let i = 0; i < H.length; i++) {
    minx = Math.min(minx, H[i].cx); maxx = Math.max(maxx, H[i].cx);
    if (!i) continue;
    const dx = H[i].cx - H[i - 1].cx;
    if (Math.abs(dx) > 0.05) { const d = Math.sign(dx); if (dir && d !== dir) rev++; dir = d; }
  }
  if (rev >= 2 && maxx - minx > 0.25) { H.length = 0; return true; }
  return false;
}

const senseCanvas = document.createElement("canvas");
senseCanvas.width = 96; senseCanvas.height = 72;
const senseCtx = senseCanvas.getContext("2d", {willReadFrequently: true});

function senseFrame(video){
  const w = 96, h = 72, now = Date.now();
  senseCtx.drawImage(video, 0, 0, w, h);
  const d = senseCtx.getImageData(0, 0, w, h).data, lum = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  const r = analyzeFrame(lum, SENSE.prev, w, h);
  SENSE.prev = lum;
  const quiet = now < SENSE.quietUntil || S.speaking || now - (S.spokeAt || 0) < 600;

  if (SENSE.follow) {
    if (now - SENSE.lastLightSent > 220) {
      SENSE.lastLightSent = now;
      sendUp({t: "light", seen: r.light.seen, x: r.light.x, area: r.light.area});
    }
    if (r.light.seen) $("#visor").dataset.look = r.light.x < -0.3 ? "left" : r.light.x > 0.3 ? "right" : "";
    return;   // no wave detection while chasing a light
  }
}

// Send to the controller if it is around. Returns false when the Eyes phone is on its own.
function sendUp(o){
  if (S.ctlAsleep || !S.ctlIp) return false;
  o.to = S.ctlIp; linkSend(o); return true;
}

/* ---------- Claps ---------- */
const EARS = {stream: null, timer: null, starting: false};
function stopEars(){
  clearInterval(EARS.timer); EARS.timer = null;
  if (EARS.stream) { EARS.stream.getTracks().forEach(t => t.stop()); EARS.stream = null; }
}
async function startEars(){
  if (!navigator.mediaDevices || EARS.stream || EARS.starting || S.listening) return;
  EARS.starting = true;
  try { await startEarsInner(); } finally { EARS.starting = false; }
}
async function startEarsInner(){
  if (HAS && !Android.hasMic()) {
    const ok = await new Promise(res => { U7.onMicPermission = res; Android.askMic(); });
    if (!ok) return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}, video: false});
  } catch(e) { console.log("mic error", e); return; }
  const ac = audio(); if (!ac) return;
  if (S.listening) { stream.getTracks().forEach(t => t.stop()); return; }
  EARS.stream = stream;
  const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
  an.fftSize = 512; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const ear = {avg: 0.01, claps: [], peakAt: 0, inPeak: false};
  EARS.timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let pk = 0, s = 0;
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; s += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); }
    clapStep(ear, Math.sqrt(s / buf.length), pk, Date.now());
  }, 20);
}

// One step of the clap detector. A clap is a sudden loud, short spike.
function clapStep(ear, rms, pk, now){
  const quiet = now < SENSE.quietUntil || S.speaking || now - (S.spokeAt || 0) < 700;
  if (!ear.inPeak && pk > 0.45 && rms > 0.07 && rms > ear.avg * 6 && now - ear.peakAt > 160) {
    ear.inPeak = true; ear.peakAt = now;
    if (!quiet) ear.claps.push(now);
  } else if (ear.inPeak) {
    if (rms < ear.avg * 3 + 0.02) ear.inPeak = false;
    else if (now - ear.peakAt > 260) { ear.claps.pop(); ear.inPeak = false; ear.peakAt = now + 400; } // too long: voice or music
  } else ear.avg = ear.avg * 0.97 + rms * 0.03;
  if (ear.claps.length && !ear.inPeak && now - ear.claps[ear.claps.length - 1] > 800) {
    const n = Math.min(ear.claps.length, 3); ear.claps = [];
    if (!quiet) clapHeard(n);
    return n;
  }
  return 0;
}

function clapHeard(n){
  wake();
  $("#visor").dataset.look = "up";
  setTimeout(() => { if ($("#visor").dataset.look === "up") $("#visor").dataset.look = ""; }, 1200);
  if (!sendUp({t: "clap", n})) say(pick(n === 1 ? "clap1" : n === 2 ? "clapAlone" : "clap3"));
}

/* ---------- Messages from the controller ---------- */
function senseLink(m){
  if (m.t === "explore") { FACES.on = !!m.on; return; }
  if (m.t === "listen") { if (!S.listening) startListen(); return; }
  if (m.t === "follow") { SENSE.follow = !!m.on; if (!m.on) $("#visor").dataset.look = ""; }
  else if (m.t === "game") SENSE.game = !!m.on;
  else if (m.t === "quiet") SENSE.quietUntil = Date.now() + (m.ms || 2500);
  else if (m.t === "happy") $("#visor").dataset.happy = m.h > 70 ? "high" : m.h < 30 ? "low" : "";
}

/* ---------- Body: picked up, shaken, tipped over, covered, dark, charging ---------- */
const BODY = {lp: [0, 0, 9.81], g0: null, hist: [], steadySince: 0, tipStart: 0, tipped: false, lifted: false,
  liftSince: 0, cool: {}, proxAt: 0, covered: false, darkSince: 0, brightSince: 0, dark: false, charging: null};

function bodyEvent(e){
  const now = Date.now();
  if (now - (BODY.cool[e] || 0) < 6000) return;
  BODY.cool[e] = now;
  wake();
  if (!sendUp({t: "body", e})) {
    if (window.bodyReact) { bodyReact(e); return; }
    const local = {tipped: "bodyTipped", upright: "bodyUpright", lifted: "bodyLifted", putdown: "bodyPutDown", shaken: "bodyShaken",
      covered: "bodyCovered", peekaboo: "bodyPeekaboo", uncovered: "bodyUncovered", dark: "bodyDark", lights: "bodyLights",
      charging: "bodyCharging", unplugged: "bodyUnplugged"}[e];
    if (local && LINES[local]) say(pick(local));
  }
}

const angleBetween = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], m = Math.hypot(...a) * Math.hypot(...b);
  return m ? Math.acos(Math.max(-1, Math.min(1, d / m))) * 57.3 : 0;
};

// One accelerometer sample (m/s², gravity included). Pure enough to test.
function bodyAccel(x, y, z, now){
  const lp = BODY.lp, v = [x, y, z];
  for (let i = 0; i < 3; i++) lp[i] = lp[i] * 0.9 + v[i] * 0.1;
  const dev = Math.abs(Math.hypot(x, y, z) - 9.81);
  const H = BODY.hist;
  H.push({t: now, dev});
  while (H.length && now - H[0].t > 1500) H.shift();
  const steady = H.length > 10 && H.every(h => h.dev < 0.6);
  if (steady) { if (!BODY.steadySince) BODY.steadySince = now; } else BODY.steadySince = 0;
  // Learn which way is "upright" whenever he has been resting calmly for a few seconds.
  const ang = BODY.g0 ? angleBetween(lp, BODY.g0) : 0;
  if (steady && now - BODY.steadySince > 3000 && !BODY.tipped && !BODY.lifted) {
    if (!BODY.g0) BODY.g0 = lp.slice();
    else if (ang < 15) for (let i = 0; i < 3; i++) BODY.g0[i] = BODY.g0[i] * 0.995 + lp[i] * 0.005;   // drift slowly
  }
  // Lying still in a new position for a long time: accept it as the new "upright" (phone re-mounted).
  if (BODY.tipped && steady && now - BODY.steadySince > 20000) { BODY.tipped = false; BODY.g0 = lp.slice(); }

  // Tipped over: gravity points a very different way for over a second.
  if (BODY.g0 && !BODY.tipped && ang > 55) {
    if (!BODY.tipStart) BODY.tipStart = now;
    if (now - BODY.tipStart > 1000) { BODY.tipped = true; BODY.lifted = false; bodyEvent("tipped"); return "tipped"; }
  } else BODY.tipStart = 0;
  if (BODY.tipped && ang < 20 && steady) { BODY.tipped = false; bodyEvent("upright"); return "upright"; }

  const moving = now < SENSE.quietUntil;   // his own walking shakes the phone: ignore that
  if (moving) return null;
  const big = H.filter(h => h.dev > 4).length;
  if (big >= 6) { H.length = 0; BODY.liftCand = 0; bodyEvent("shaken"); return "shaken"; }
  // Picked up: a clear bump, then uneven motion that isn't shaking, for most of a second.
  const busy = H.filter(h => h.dev > 0.8).length / Math.max(1, H.length);
  const liftish = !BODY.lifted && !BODY.tipped && H.length > 15 && busy > 0.4 && big < 3;
  if (liftish && !BODY.liftCand && H.some(h => h.dev > 2.2)) BODY.liftCand = now;
  if (!liftish) BODY.liftCand = 0;
  if (BODY.liftCand && now - BODY.liftCand > 700) {
    BODY.liftCand = 0; BODY.lifted = true; BODY.liftSince = now; bodyEvent("lifted"); return "lifted";
  }
  if (BODY.lifted && steady && now - BODY.steadySince > 1500 && now - BODY.liftSince > 2000) {
    BODY.lifted = false; bodyEvent("putdown"); return "putdown";
  }
  return null;
}

U7.onAccel = (x, y, z) => { if (isEyes()) bodyAccel(x, y, z, Date.now()); };
U7.onProx = near => {
  if (!isEyes()) return;
  const now = Date.now();
  if (near) {
    BODY.proxAt = now;
    setTimeout(() => { if (BODY.proxAt === now) { BODY.covered = true; $("#visor").dataset.mood = "sleep"; bodyEvent("covered"); } }, 1200);
  } else {
    const held = now - BODY.proxAt;
    BODY.proxAt = 0;
    if (BODY.covered) { BODY.covered = false; $("#visor").dataset.mood = "surprised"; bodyEvent(held < 9000 ? "peekaboo" : "uncovered"); }
  }
};
U7.onLight = lux => {
  if (!isEyes()) return;
  const now = Date.now();
  if (lux < 3) { BODY.brightSince = 0; if (!BODY.darkSince) BODY.darkSince = now; if (!BODY.dark && now - BODY.darkSince > 8000) { BODY.dark = true; bodyEvent("dark"); } }
  else if (lux > 15) { BODY.darkSince = 0; if (!BODY.brightSince) BODY.brightSince = now; if (BODY.dark && now - BODY.brightSince > 3000) { BODY.dark = false; bodyEvent("lights"); } }
};
function startBody(){
  if (!HAS) return;
  Android.body(true);
  setInterval(() => {
    let c; try { c = Android.charging(); } catch(e) { return; }
    if (BODY.charging !== null && c !== BODY.charging) bodyEvent(c ? "charging" : "unplugged");
    BODY.charging = c;
  }, 10000);
}

/* ---------- Faces (Explore mode): find people and send their face fingerprint to the controller ---------- */
const FACES = {on: false, busy: false, id: 0, pending: {}, cv: null};
U7.onFaces = (id, arr) => { const f = FACES.pending[id]; if (f) { delete FACES.pending[id]; f(arr || []); } };
function faceTick(video){
  if (!FACES.on || FACES.busy || !HAS || !Android.detectFaces || !video.videoWidth) return;
  FACES.busy = true;
  if (!FACES.cv) FACES.cv = document.createElement("canvas");
  const w = 320, h = Math.round(w * video.videoHeight / video.videoWidth);
  FACES.cv.width = w; FACES.cv.height = h;
  FACES.cv.getContext("2d").drawImage(video, 0, 0, w, h);
  const data = FACES.cv.toDataURL("image/jpeg", 0.8);
  const id = "f" + (++FACES.id);
  const done = arr => {
    FACES.busy = false;
    if (arr.length) {
      const big = arr[0];
      $("#visor").dataset.look = big.x < -0.35 ? "left" : big.x > 0.35 ? "right" : "";
      sendUp({t: "faces", faces: arr});
    }
  };
  const t = setTimeout(() => { if (FACES.pending[id]) { delete FACES.pending[id]; done([]); } }, 5000);
  FACES.pending[id] = arr => { clearTimeout(t); done(arr); };
  Android.detectFaces(id, data, true);
}
