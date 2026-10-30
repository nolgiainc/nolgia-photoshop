// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 NOLGIA Inc
//
// Run code and Deny answer only a deliberate click (ui/arming.js), in the
// approval window (ui/approval.js) and on the panel's card (ui/panel.js).
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { armButtons, ARM_MS } = require("../ui/arming.js");
const { createApprovalWindow } = require("../ui/approval.js");

class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.textContent = "";
    this.className = "";
    const classes = new Set();
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    };
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  fire(type) {
    for (const fn of this.listeners[type] || []) fn({ type });
  }
  /** A mouse click: the pointer goes down, then the click. */
  click() {
    this.fire("pointerdown");
    this.fire("mousedown");
    this.fire("click");
  }
}

function clockAndTimers() {
  const c = { now: 1000, timers: [] };
  c.tick = (ms) => {
    c.now += ms;
    for (const t of c.timers.filter((t) => !t.done && t.at <= c.now)) {
      t.done = true;
      t.fn();
    }
  };
  c.opts = {
    now: () => c.now,
    setTimer: (fn, ms) => {
      const t = { fn, at: c.now + ms, done: false };
      c.timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      if (t) t.done = true;
    },
  };
  return c;
}

function setup() {
  const c = clockAndTimers();
  const approve = new FakeEl("div");
  const deny = new FakeEl("div");
  const answers = [];
  const lines = [];
  const arm = armButtons(approve, deny, {
    answer: (id, ok) => answers.push([id, ok]),
    log: (m) => lines.push(m),
    label: () => "Run code",
    ...c.opts,
  });
  return { c, approve, deny, answers, lines, arm };
}

test("a click as the request shows is never an answer, one after a second is", () => {
  // The owner's Mac test 3: approved about 3 s after the window opened, no click.
  const { c, approve, answers, lines, arm } = setup();
  arm.show("cmd-1");
  assert.ok(approve.classList.contains("disabled"));
  c.tick(300);
  approve.click();
  assert.deepEqual(answers, []);
  assert.match(lines.at(-1), /^Ignored a click on Run code for request cmd-1: it came before the request's buttons were on\.$/);
  c.tick(ARM_MS);
  assert.ok(!approve.classList.contains("disabled"));
  approve.click();
  assert.deepEqual(answers, [["cmd-1", true]]);
  assert.equal(lines.at(-1), "The person clicked Run code for request cmd-1.");
});

test("a press before the buttons turn on never counts, even released after", () => {
  const { c, approve, answers, lines, arm } = setup();
  arm.show("cmd-1");
  c.tick(300);
  approve.fire("pointerdown");
  c.tick(1200);
  approve.fire("click");
  assert.deepEqual(answers, []);
  assert.match(lines.at(-1), /the pointer went down on it before the buttons were on/);
});

test("a click whose press was not on the button never counts", () => {
  const { c, approve, deny, answers, lines, arm } = setup();
  arm.show("cmd-1");
  c.tick(ARM_MS);
  deny.fire("pointerdown");
  approve.fire("click");
  approve.click(); // a pointer-down only once ever is enough to know presses arrive
  assert.deepEqual(answers, [["cmd-1", true]]);
  assert.match(lines[0], /^Ignored a click on Run code for request cmd-1: the pointer did not go down on it/);
});

test("an answer goes only to the request the buttons were turned on for", () => {
  const { c, approve, deny, answers, arm } = setup();
  arm.show("cmd-a");
  c.tick(ARM_MS);
  approve.fire("pointerdown");
  arm.show("cmd-b"); // cmd-a went (answered elsewhere, timed out): cmd-b takes its place
  approve.fire("click");
  assert.deepEqual(answers, []);
  c.tick(ARM_MS);
  deny.click();
  assert.deepEqual(answers, [["cmd-b", false]]);
});

test("nothing answers once hidden", () => {
  const { c, approve, answers, arm } = setup();
  arm.show("cmd-1");
  c.tick(ARM_MS);
  arm.hide();
  approve.click();
  assert.deepEqual(answers, []);
});

test("keys never answer: the buttons are plain elements with no key listener", () => {
  const { approve, deny } = setup();
  for (const el of [approve, deny]) {
    assert.equal(el.tagName, "div");
    assert.deepEqual(Object.keys(el.listeners).sort(), ["click", "mousedown", "pointerdown"]);
  }
});

function fakeDoc() {
  const doc = { body: new FakeEl("body") };
  doc.createElement = (tag) => {
    const node = new FakeEl(tag);
    if (tag === "dialog") {
      node.uxpShowModal = () =>
        new Promise((resolve) => {
          node.resolveModal = resolve;
        });
      node.close = (value) => node.resolveModal && node.resolveModal(value);
    }
    return node;
  };
  return doc;
}

function find(node, text) {
  if (node.textContent === text) return node;
  for (const child of node.children) {
    const hit = find(child, text);
    if (hit) return hit;
  }
  return null;
}

test("the approval window answers only an armed click, for its own request", async (t) => {
  const doc = fakeDoc();
  const lines = [];
  const decided = [];
  const controller = {
    executor: { approvals: [] },
    approve: (id) => decided.push(["approve", id]),
    deny: (id) => decided.push(["deny", id]),
  };
  const pending = { id: "cmd-run", request: { title: "Run?", lines: ["x = 1"], approveLabel: "Run code", code: "x = 1" } };
  controller.executor.approvals.push(pending);
  const win = createApprovalWindow(doc, (m) => lines.push(m));
  win.update(controller.executor.approvals, controller);
  const approve = find(doc.body, "Run code");
  assert.ok(approve, "the window has Run code");
  approve.click(); // as it opens
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(decided, []);
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + ARM_MS + 10 });
  approve.click();
  t.mock.timers.reset();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(decided, [["approve", "cmd-run"]]);
  assert.ok(lines.includes("The person clicked Run code for request cmd-run."), lines);
});
