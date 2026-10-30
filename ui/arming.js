// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 NOLGIA Inc
//
// When a click on Run code or Deny answers a request. The owner's Mac test 3
// (2026-10-29): a request in the Resolve plugin was approved about 3 s after
// its window opened, with the pointer resting where its button appears and
// nobody clicking. So, in the approval window and on the panel's card:
// - each time a request shows, both buttons refuse clicks for ARM_MS (they
//   look off until then);
// - a click counts only when the pointer went down on that same button after
//   that: a press from before, even one released on the button later, never
//   counts;
// - the buttons are plain elements, never focusable and never a default
//   button, so no key answers;
// - an answer goes to the request id the buttons were turned on for;
// - every answer and every refused click is logged with its request id.
// A UXP that sent no pointer or mouse press at all would leave only the
// time rule (logged once); every Photoshop it supports sends them.
"use strict";

const ARM_MS = 1000;

/**
 * Wire Approve and Deny elements. `answer(id, approve)` answers request `id`;
 * `label()` is the approve button's text for the log. Returns {show(id),
 * hide(), shownId()}: call show(id) every time a request shows on them.
 */
function armButtons(approveEl, denyEl, { answer, log = () => {}, label = () => "Approve", now = () => Date.now(),
  setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let shownId = null;
  let armedAt = Infinity;
  let press = null; // {el, id, early}
  let timer = null;
  let pressesSeen = false;
  let noPressLogged = false;

  const looksOff = (off) => {
    for (const el of [approveEl, denyEl]) {
      if (off) el.classList.add("disabled");
      else el.classList.remove("disabled");
    }
  };

  function show(id) {
    shownId = id;
    press = null;
    armedAt = now() + ARM_MS;
    looksOff(true);
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      if (shownId === id) looksOff(false);
    }, ARM_MS);
  }

  function hide() {
    shownId = null;
    press = null;
    armedAt = Infinity;
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function down(el) {
    pressesSeen = true;
    if (shownId === null) return;
    press = { el, id: shownId, early: now() < armedAt };
  }

  function click(el, approve) {
    const id = shownId;
    const p = press;
    press = null;
    if (id === null) return;
    const what = approve ? label() : "Deny";
    let why = null;
    if (now() < armedAt) why = "it came before the request's buttons were on";
    else if (!pressesSeen) {
      if (!noPressLogged) log("This panel gets no pointer presses; a click on a request's buttons counts once they are on.");
      noPressLogged = true;
    } else if (!p || p.el !== el || p.id !== id) why = "the pointer did not go down on it after the buttons were on";
    else if (p.early) why = "the pointer went down on it before the buttons were on";
    if (why) {
      log("Ignored a click on " + what + " for request " + id + ": " + why + ".");
      return;
    }
    log("The person clicked " + what + " for request " + id + ".");
    answer(id, approve);
  }

  for (const [el, approve] of [[approveEl, true], [denyEl, false]]) {
    el.addEventListener("pointerdown", () => down(el));
    el.addEventListener("mousedown", () => down(el));
    el.addEventListener("click", () => click(el, approve));
  }
  return { show, hide, shownId: () => shownId };
}

module.exports = { armButtons, ARM_MS };
