"use strict";
/* Leg calibration: small trims (−30…+30) for each of the 8 servos, saved on the robot
   through /api/v1/calibration. Each change is saved and shown on the robot straight away. */

const CAL_LEGS = [["RF", "Right front"], ["LF", "Left front"], ["RR", "Right rear"], ["LR", "Left rear"]];
const CAL = {orig: null, now: null, pose: "center", timer: null, saving: false, again: false, zeroArm: 0};
const calHint = {
  center: "Center pose: every servo sits at its middle. Each leg should point straight out at a diagonal, the same angle on all four corners. Use Swing to line the legs up and Lift to level the feet.",
  stand: "Stand pose: this is how he stands for walking. All four feet should touch the floor evenly and the body should sit level. Fine-tune Lift until no foot hovers or pushes harder than the others."
};

function calRender(){
  $("#calHint").textContent = calHint[CAL.pose];
  $$("[data-calpose]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.calpose === CAL.pose)));
  $("#calRows").innerHTML = CAL_LEGS.map(([key, name]) => {
    const L = LEGS[key];
    return '<div class="cal-leg' + (S.leg === key ? " sel" : "") + '" data-calleg="' + key + '"><h3>' + name + '</h3>' +
      '<div class="cal-row"><span>Lift</span><button data-cal="' + L.lift + '" data-d="down">Foot down</button>' +
      '<output id="calv' + L.lift + '">' + fmtOff(CAL.now[L.lift]) + '</output><button data-cal="' + L.lift + '" data-d="up">Foot up</button></div>' +
      '<div class="cal-row"><span>Swing</span><button data-cal="' + L.swing + '" data-d="back">Back</button>' +
      '<output id="calv' + L.swing + '">' + fmtOff(CAL.now[L.swing]) + '</output><button data-cal="' + L.swing + '" data-d="fwd">Forward</button></div></div>';
  }).join("");
}
const fmtOff = v => (v > 0 ? "+" : "") + v;

async function calLoad(){
  const r = await req("GET", "/api/v1/calibration");
  const offs = r.json && r.json.ok && r.json.data && r.json.data.offsets;
  if (!Array.isArray(offs) || offs.length !== 8) return null;
  return offs.map(v => Math.round(+v || 0));
}
async function calShowPose(){
  S.pos = null;
  await runAction(CAL.pose === "center" ? ACT.center : ACT.stand);
}
// Save (debounced) and redraw the pose so the change shows on the robot.
function calQueue(){
  clearTimeout(CAL.timer);
  $("#calStatus").textContent = "Saving…";
  CAL.timer = setTimeout(calSave, 500);
}
async function calSave(){
  if (CAL.saving) { CAL.again = true; return; }
  CAL.saving = true;
  const r = await req("POST", "/api/v1/calibration", JSON.stringify({offsets: CAL.now}));
  const ok = r.json && r.json.ok;
  $("#calStatus").textContent = ok ? "Saved on the robot." : "The robot didn't accept that. Check the connection and try again.";
  if (ok) await calShowPose();
  CAL.saving = false;
  if (CAL.again) { CAL.again = false; calSave(); }
}

$("#calStart").addEventListener("click", async () => {
  if (!S.online) { await refreshState(); if (!S.online) { toast("Not connected. Join the robot’s Wi-Fi."); return; } }
  const offs = await calLoad();
  if (!offs) { toast("Couldn't read the robot's calibration. Try again."); return; }
  CAL.orig = offs.slice(); CAL.now = offs.slice(); CAL.pose = "center";
  $("#calIntro").hidden = true; $("#calPanel").hidden = false;
  calRender();
  $("#calStatus").textContent = "Loaded the robot's current trims.";
  say(pick("calStart"));
  await makeRoom();
  await calShowPose();
});

$("#calRows").addEventListener("click", e => {
  const b = e.target.closest("button[data-cal]");
  const legBox = e.target.closest("[data-calleg]");
  if (legBox && S.leg !== legBox.dataset.calleg) { S.leg = legBox.dataset.calleg; syncLegUI(); $$(".cal-leg").forEach(x => x.classList.toggle("sel", x === legBox)); }
  if (!b) return;
  const i = +b.dataset.cal;
  // "Foot up" means raising the foot, whichever way that servo turns.
  let d = b.dataset.d === "fwd" ? 1 : b.dataset.d === "back" ? -1 : (b.dataset.d === "up" ? 1 : -1) * LIFT[i].s;
  CAL.now[i] = clamp(CAL.now[i] + d, -30, 30);
  $("#calv" + i).textContent = fmtOff(CAL.now[i]);
  if (HAS) Android.vibrate(10);
  calQueue();
});
$$("[data-calpose]").forEach(b => b.addEventListener("click", () => { CAL.pose = b.dataset.calpose; calRender(); calShowPose(); }));
$("#calUndo").addEventListener("click", () => { CAL.now = CAL.orig.slice(); calRender(); calQueue(); });
$("#calZero").addEventListener("click", () => {
  if (Date.now() - CAL.zeroArm > 4000) { CAL.zeroArm = Date.now(); toast("Tap Zero all again to clear every trim."); return; }
  CAL.zeroArm = 0; CAL.now = new Array(8).fill(0); calRender(); calQueue();
});
$("#calTest").addEventListener("click", () => walkSteps(ACT.forward, 2, "Test walk"));
$("#calDone").addEventListener("click", async () => {
  clearTimeout(CAL.timer);
  if (CAL.now.some((v, i) => v !== CAL.orig[i]) || CAL.saving) await calSave();
  $("#calPanel").hidden = true; $("#calIntro").hidden = false;
  await runAction(ACT.stand);
  say(pick("calDone"));
});
