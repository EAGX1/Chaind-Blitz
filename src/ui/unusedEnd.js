/** Slice & Dice steal: confirm End only when another legal play is still glowing. */

const PASSIVE = new Set(["end", "undo"]);

export function unusedPlayCount(actions) {
  return (actions || []).filter((a) => a && !PASSIVE.has(a.type)).length;
}

export function shouldConfirmEndMain(actions) {
  return unusedPlayCount(actions) > 0;
}

export function shouldConfirmEndBattle(attackers) {
  return (attackers || []).length > 0;
}

export function unusedEndBody(count, phase) {
  const n = Number(count) || 0;
  const name = phase === "BP" ? "Battle" : phase === "M2" ? "Main 2" : "Main";
  const plays = n === 1 ? "1 legal play" : `${n} legal plays`;
  return `You still have ${plays} glowing. End ${name} anyway?`;
}
