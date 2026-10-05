/* Unit 7's voice. [Brackets] play as sound effects, not speech.
   Each entry: [mood, line]. One is picked at random. */
window.LINES = {
  boot: [
    ["happy", "[Gyro whir] Unit 7, online. All four legs present. I checked twice."],
    ["happy", "[Leg tap] Maintenance crawler Unit 7, reporting. Ready for work orders."]
  ],
  bootNoRobot: [
    ["worried", "[Gyro whir] Unit 7, online. But I can't feel my legs. Please connect me to the robot's Wi-Fi."]
  ],
  connected: [
    ["happy", "[Leg tap] Body link established. Four-point stability confirmed."],
    ["happy", "Legs detected. One, two, three, four. Good. Nobody is missing."]
  ],
  forward: [
    ["busy", "Work order accepted. Proceeding forward."],
    ["busy", "[Leg tap] Forward. Counting steps."],
    ["busy", "Advancing. Chief says the Origin Press is this way. Probably."]
  ],
  backward: [
    ["busy", "Reversing. Watching where I put my back legs."],
    ["busy", "[Leg tap] Backing up. Carefully. Very carefully."]
  ],
  turnleft: [
    ["busy", "[Leg tap] Rotating left. Please tell Chief I did it neatly."],
    ["busy", "Turning left. Pivot sequence engaged."]
  ],
  turnright: [
    ["busy", "[Leg tap] Rotating right."],
    ["busy", "Turning right. All feet accounted for."]
  ],
  stepleft: [["busy", "Side-step left. Crab mode."]],
  stepright: [["busy", "Side-step right. Crab mode."]],
  stop: [
    ["idle", "Halted. Holding position. I am very good at holding position."],
    ["idle", "[Leg tap] Stopped. All four feet on the ground."]
  ],
  emergency: [
    ["surprised", "[Joint creak] Emergency stop! Freezing!"]
  ],
  flipStop: [
    ["surprised", "Phone flipped. Emergency stop. I'm not moving a single bolt."]
  ],
  sit: [
    ["sleep", "Lowering chassis. A short rest is allowed in the manual. Page forty."]
  ],
  stand: [
    ["happy", "[Gyro whir] Standing up. Tall as a maintenance crawler gets."]
  ],
  wave: [
    ["happy", "[Leg tap] Hello! This is my front-right leg. It is also saying hello."],
    ["happy", "Greeting protocol. Wave, wave."]
  ],
  dance: [
    ["happy", "[Gyro whir] Dance routine. Sparky taught me this one. Don't tell Chief."],
    ["happy", "Rhythm subroutine loaded. Please don't film this."]
  ],
  pushups: [
    ["busy", "Push-ups. Strength maintenance. One… two…"]
  ],
  fight: [
    ["worried", "[Joint creak] Defensive stance. I'm very fierce. Mostly."]
  ],
  sleep: [
    ["sleep", "Entering low-power mode. Wake me if a bolt needs checking."]
  ],
  center: [
    ["think", "[Gyro whir] Centering all servos. Recalibrating my sense of straight."]
  ],
  hopStart: [
    ["surprised", "Jump requested. This is the best day of my—"],
    ["surprised", "Crouching. Charging legs. Here I go!"]
  ],
  hopLand: [
    ["happy", "[Gyro whir] Landing. Did I go up? Please say I went up."],
    ["happy", "[Leg tap] I left the ground! I think. Logging it as a yes."]
  ],
  hopCooldown: [
    ["worried", "My legs need a few seconds before the next jump. Safety regulation."]
  ],
  legLift: [
    ["think", "Lifting the leg. Three-point balance… [Joint creak] mostly confirmed."]
  ],
  pilotOn: [
    ["busy", "Pilot link active. Tilt me where you need me."]
  ],
  intro: [
    ["happy", "I'm Unit 7, a maintenance crawler from the Aegis line. I climb into machines and check bolts. I travel with Chief, Sparky and Whirr to the Origin Press. There were never Units one through six. The label printer jammed. I think."]
  ],
  chief: [
    ["think", "Chief is Voltnutt. He talks like someone who used to own planets. I don't ask about it."]
  ],
  thanks: [["happy", "[Leg tap] Happy to be of service."]],
  praise: [
    ["happy", "[Gyro whir] Praise logged. Saving it to permanent memory."],
    ["happy", "Thank you. I will tell the other units. If I ever find them."]
  ],
  hello: [["happy", "Hello, operator. Unit 7 at your service."]],
  unknown: [
    ["think", "[Leg tap] That instruction is not in my manual. Could you say it again, slower?"],
    ["think", "Unrecognized work order. Try walk, turn, wave, dance, or jump."]
  ],
  didntHear: [["think", "I didn't catch that. My audio sensor is very small."]],
  batteryOk: [["happy", "Phone power at {n} percent. Plenty for work."]],
  batteryLow: [["worried", "[Joint creak] Phone power at {n} percent. Requesting a recharge and maybe a small rest."]],
  noLink: [["worried", "I can't reach my legs. Join the robot's Wi-Fi first."]],
  count: [["busy", "{n}."]],
  headLinked: [["happy", "[Gyro whir] Head unit online. Four lenses and one camera, all pointing forward."]],
  eyesLinked: [
    ["happy", "[Gyro whir] Eyes mounted. I can see where I'm going now."],
    ["happy", "Optical unit attached. Four lenses, all pointing forward. Excellent."]
  ],
  cardParty: [["party", "[Gyro whir] Party card detected! Celebration protocol engaged. Sparky would be so proud."]],
  cardOil: [["happy", "[Glug] Premium machine oil! My joints say thank you."]],
  cardWake: [["happy", "[Gyro whir] Waking up. Systems green. Bolts tight."]],
  cardHappy: [["happy", "[Leg tap] Happy card! Doing my happy shuffle."]],
  cardScared: [["worried", "[Joint creak] That card is scary. Backing away slowly."]],
  cardFierce: [["angry", "Fierce mode. I am a very dangerous maintenance crawler."]],
  cardSad: [["sad", "[Joint creak] Sad card. I need to sit down for a moment."]],
  cardCurious: [["think", "Curious. Scanning the area. Left… right…"]],
  cardChief: [["happy", "[Leg tap] Chief! Unit 7 reporting for duty. All bolts checked."]],
  cardHello: [["happy", "Hello, operator! Say hello or hi and I'll wave."]],
  cardColor: [["happy", "[Gyro whir] Lens colour changed to {c}."]],
  cardAmber: [["happy", "[Gyro whir] Back to standard amber. Factory settings."]],
  cardUnknown: [["think", "[Leg tap] That code isn't one of my cards."]],
  bootHigh: [["happy", "[Gyro whir] Unit 7, online and feeling excellent. All four legs polished."]],
  bootLow: [["sad", "[Joint creak] Unit 7, online. Nobody has encouraged me in a while. Just saying."]],
  gestureWave: [
    ["happy", "[Leg tap] I saw that wave! Waving back."],
    ["happy", "Wave detected. Returning greeting."]
  ],
  clap1: [["surprised", "Clap detected! Ears… I mean audio sensor, alert."]],
  clap2: [["busy", "[Leg tap] Two claps. Coming over!"]],
  clap3: [["party", "[Gyro whir] Three claps! That means dance time."]],
  clapAlone: [["happy", "Two claps! I'd come over, but my legs aren't linked."]],
  followStart: [["busy", "[Gyro whir] Light-tracking mode. Shine it and I'll follow."]],
  lightLost: [["worried", "Light lost. Stopping here. It's very dark without it."]],
  needEyes: [["worried", "I need my eyes for that. Link the Eyes phone first."]],
  quizStart: [["happy", "[Gyro whir] Colour Quiz! I'll name a colour, you show me the card. Five rounds. Ready?"]],
  quizAsk: [["think", "Show me {c}!"], ["think", "Quick! Find the {c} card!"]],
  quizRight: [["happy", "[Leg tap] Correct!"], ["happy", "Yes! That's the one."]],
  quizWrong: [["worried", "That's {c}. Not quite! Try again."]],
  quizTimeout: [["sad", "Time's up. It was {c}."]],
  needColour: [["think", "I need a colour card for this game."]],
  copyStart: [["happy", "[Gyro whir] Copy Me! Watch my lenses, then show me the same colours in the same order."]],
  copyWatch: [["think", "Watch carefully. {n} colours."]],
  copyGo: [["listen", "Your turn!"]],
  copyRight: [["happy", "[Leg tap] Perfect copy! All {n} correct."]],
  copyFail: [["sad", "[Joint creak] Wrong order. You completed {n} rounds."]],
  seekStart: [["happy", "Hide and Seek! Turn the lights down, hide, and keep your flashlight on. I'll count to ten."]],
  seekReady: [["busy", "[Gyro whir] Ready or not, here I come!"]],
  seekFound: [["happy", "[Leg tap] Found you! It took me {s} seconds."]],
  seekGiveUp: [["sad", "I searched every direction. I give up. You win!"]],
  huntStart: [["happy", "[Gyro whir] Treasure Hunt! Hide the five treasure cards, then drive me to find them. Show me each one when we get there."]],
  huntFound: [["happy", "Treasure {n} found! That's {k} of 5."]],
  huntDup: [["think", "We already found treasure {n}. Keep searching!"]],
  huntDone: [["party", "[Gyro whir] All five treasures found in {t}! Excellent teamwork."]],
  treasureIdle: [["think", "A treasure card! Start a Treasure Hunt and I'll count it."]],
  gameEnd: [["idle", "Game over. Back to work orders."]],
  noGame: [["think", "We're not playing a game right now."]],
  gameWin: [["party", "[Gyro whir] {game} complete! Score: {n}. That was brilliant."]],
  gameTry: [["happy", "{game} over. Score: {n}. Let's play again soon."]],
  encourage1: [["happy", "[Leg tap] Good job card! Thank you. Plus one point."]],
  encourage2: [["happy", "[Gyro whir] Well done card! My bolts are glowing. Plus two points."]],
  encourage3: [["party", "[Gyro whir] A Gold Bolt! The highest honour for a crawler. Plus three points!"]],
  encourageAgain: [["happy", "I already logged that card. But thank you, it still feels nice."]],
  promote: [["party", "[Gyro whir] Promotion! I am now a {rank}. I must tell Chief!"]],
  unlock: [["happy", "New ability unlocked: {what}."]],
  status: [["happy", "I'm a {rank} with {n} points. {left} more to become {next}."]],
  statusHigh: [["happy", "I'm a {rank} with {n} points, and I feel fantastic."]],
  statusLow: [["sad", "I'm a {rank} with {n} points. I could use some encouragement."]],
  goldLocked: [["think", "Gold lenses unlock when I become a Senior Crawler."]],
  lonely: [["sad", "[Joint creak] Has anyone seen a Good Job card? Asking for a friend. The friend is me."]],
  wakeYes: [["listen", "Yes? Unit 7 listening."]],
  calStart: [["think", "[Gyro whir] Calibration mode. I'll hold still while you adjust my legs. It tickles a little."]],
  calDone: [["happy", "[Leg tap] Calibration saved. All four legs feel straighter already."]],
  eyesBatteryLow: [["worried", "[Joint creak] My eyes are at {n} percent power. Please charge the small phone soon."]]
};
