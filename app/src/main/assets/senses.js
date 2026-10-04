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
async function startEars(){
  if (!navigator.mediaDevices) return;
  if (HAS && !Android.hasMic()) {
    const ok = await new Promise(res => { U7.onMicPermission = res; Android.askMic(); });
    if (!ok) return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}, video: false});
  } catch(e) { console.log("mic error", e); return; }
  const ac = audio(); if (!ac) return;
  const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
  an.fftSize = 512; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const ear = {avg: 0.01, claps: [], peakAt: 0, inPeak: false};
  setInterval(() => {
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
  if (m.t === "follow") { SENSE.follow = !!m.on; if (!m.on) $("#visor").dataset.look = ""; }
  else if (m.t === "game") SENSE.game = !!m.on;
  else if (m.t === "quiet") SENSE.quietUntil = Date.now() + (m.ms || 2500);
  else if (m.t === "happy") $("#visor").dataset.happy = m.h > 70 ? "high" : m.h < 30 ? "low" : "";
}
