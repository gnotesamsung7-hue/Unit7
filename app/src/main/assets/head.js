"use strict";
/* Controller side of Unit 7's head (XIAO ESP32S3 Sense + round display).
   The head only takes pictures; this phone reads the cards and finds the light. */

const HEAD = {busy: false, pending: {}, id: 0, last: "", lastAt: 0, cv: null, small: null, look: ""};
U7.onImage = (id, data) => { const f = HEAD.pending[id]; if (f) { delete HEAD.pending[id]; f(data); } };

function headSnap(){
  const url = "http://" + S.eyes.ip + "/jpg";
  if (HAS) {
    const id = "i" + (++HEAD.id);
    return new Promise(res => { HEAD.pending[id] = res; Android.fetchImage(id, url); });
  }
  return fetch(url).then(r => r.ok ? r.blob() : null)
    .then(b => b ? new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }) : "")
    .catch(() => "");
}

function headLookAt(dir){
  if (dir === HEAD.look) return;
  HEAD.look = dir; look(dir);
}

async function headLook(){
  if (HEAD.busy || P.role !== "ctl" || !S.eyes.linked || S.eyes.kind !== "head") return;
  HEAD.busy = true;
  try {
    const data = await headSnap();
    if (!data) return;
    const img = new Image(); img.src = data; await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!HEAD.cv) {
      HEAD.cv = document.createElement("canvas");
      HEAD.small = document.createElement("canvas"); HEAD.small.width = 96; HEAD.small.height = 72;
    }
    if (FOLLOW.on) {   // light tracking only, for speed
      const sctx = HEAD.small.getContext("2d", {willReadFrequently: true});
      sctx.drawImage(img, 0, 0, 96, 72);
      const d = sctx.getImageData(0, 0, 96, 72).data, lum = new Uint8ClampedArray(96 * 72);
      for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
      const r = analyzeFrame(lum, null, 96, 72);
      FOLLOW.light = r.light;
      if (r.light.seen) FOLLOW.seenAt = Date.now();
      headLookAt(r.light.seen ? (r.light.x < -0.3 ? "left" : r.light.x > 0.3 ? "right" : "") : "");
      return;
    }
    if (HEAD.look) headLookAt("");
    const cv = HEAD.cv; cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d", {willReadFrequently: true});
    ctx.drawImage(img, 0, 0);
    const q = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts: "dontInvert"});
    if (q && q.data) headCard(q.data.trim());
  } catch(e) {
  } finally { HEAD.busy = false; }
}

function headCard(code){
  const now = Date.now(), game = GAME.on;
  if (code === HEAD.last && now - HEAD.lastAt < (game ? 2500 : 6000)) return;
  if (now - HEAD.lastAt < (game ? 1000 : 2000)) return;
  HEAD.last = code; HEAD.lastAt = now;
  beep("up"); setMood("seen");
  setTimeout(() => doCard(code), 250);
}

setInterval(headLook, 250);
