// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 NOLGIA Inc
//
// The chat in the NOLGIA panel, against the mock API's agent routes.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ApiClient } = require("../core/api.js");
const { AgentChat, formatReply, sessionName, timeKey, failureText, turnRate, MAX_CHARS } = require("../core/chat.js");
const { Controller } = require("../core/controller.js");
const { AGENT_URL, BILLING_URL, COST_LINE } = require("../core/constants.js");
const { TOKEN, startMock, call, mockState, until, fakeHost } = require("./support.js");

let mock;
test.before(async () => {
  mock = await startMock();
});
test.after(async () => {
  await mock.stop();
});
test.beforeEach(async () => {
  await call(mock, "POST", "/mock/reset", null, { token: null });
});

// A failed test must not leave a chat polling (it would keep Node running).
const made = [];
function newChat(o) {
  const chat = new AgentChat(o);
  made.push(chat);
  return chat;
}
test.afterEach(() => {
  for (const chat of made.splice(0)) chat.reset({ forget: false });
});

/** The parts of the Controller the chat uses. */
function owner(host = fakeHost(), { token = TOKEN } = {}) {
  const o = {
    host,
    instanceId: "unit-instance",
    apiUrl: mock.baseUrl,
    authFailures: [],
    bumps: 0,
    api: () => new ApiClient({ baseUrl: mock.baseUrl, token, fetch: host.fetch }),
    accountEmail: () => "test@nolgia.ai",
    bump() {
      o.bumps += 1;
    },
    log(m) {
      host.log(m);
    },
    authFailed(text) {
      o.authFailures.push(text);
    },
  };
  return o;
}

const mockAgent = (body) => call(mock, "POST", "/mock/agent", body, { token: null });
const reply = (body = {}) => call(mock, "POST", "/mock/agent/reply", body, { token: null });

async function settled(chat) {
  await until(() => !chat.busy && chat.loaded, { timeout: 15000, what: "the reply" });
}

test("replies are drawn as paragraphs, list items, bold text and https links only", () => {
  const blocks = formatReply(
    "## Done\n\nI painted **five layers** in `Untitled-2`.\n\n- Shapes\n2. Brush strokes along a path\n\nSee [your library](https://nolgia.ai/library) or https://nolgia.ai/agent. Not http://x.test or [this](javascript:alert(1)).\n```js\ncode\n```",
  );
  assert.deepEqual(blocks[0], { type: "p", parts: [{ text: "Done", bold: true }] });
  assert.deepEqual(blocks[1].parts, [{ text: "I painted " }, { text: "five layers", bold: true }, { text: " in Untitled-2." }]);
  assert.deepEqual(blocks[2], { type: "li", parts: [{ text: "Shapes" }] });
  assert.deepEqual(blocks[3], { type: "li", parts: [{ text: "Brush strokes along a path" }] });
  const links = blocks[4].parts.filter((p) => p.href);
  assert.deepEqual(links, [
    { text: "your library", href: "https://nolgia.ai/library" },
    { text: "https://nolgia.ai/agent", href: "https://nolgia.ai/agent" },
  ]);
  assert.ok(blocks[4].parts.every((p) => !p.href || p.href.startsWith("https://")));
  assert.equal(blocks.length, 6, "the code fence lines are dropped, its body kept as text");
});

test("a chat's name on nolgia.ai says it came from Photoshop", () => {
  assert.equal(sessionName("Make an abstract art in my photoshop, using default colors"), "Photoshop: Make an abstract art in my");
  assert.equal(sessionName("   "), "Photoshop: New chat");
  assert.ok(sessionName("x".repeat(200)).length <= 80);
});

test("times sort to the microsecond, whatever their fraction", () => {
  const order = ["2026-10-29T00:15:01Z", "2026-10-29T00:15:01.000001Z", "2026-10-29T00:15:01.5Z", "2026-10-29T00:15:02Z"];
  assert.deepEqual(order.slice().sort((a, b) => (timeKey(a) < timeKey(b) ? -1 : 1)), order);
});

test("the first message starts a chat pinned to this Photoshop; the reply comes back", async () => {
  const host = fakeHost();
  const o = owner(host);
  const chat = newChat(o);
  await chat.start();
  assert.equal(chat.view().empty, true);
  assert.equal(await chat.send("Make an abstract art in my photoshop, using default colors and brushes and tools."), true);
  assert.equal(chat.view().busy, true);
  assert.match(chat.view().working, /working/i);
  let state = await mockState(mock);
  assert.deepEqual(state.agent_creates, [{ name: "Photoshop: Make an abstract art in my", app: { app: "photoshop", instance_id: "unit-instance" } }]);
  assert.deepEqual(state.agent_submits[0], {
    content: "Make an abstract art in my photoshop, using default colors and brushes and tools.",
    session_id: state.agent_sessions[0].id,
  });
  assert.equal(state.agent_sessions[0].app.app, "photoshop");
  assert.deepEqual(host.remembered.chat, { id: state.agent_sessions[0].id, api: mock.baseUrl, email: "test@nolgia.ai" });
  await reply({ content: "I made **Untitled-2** with six layers.\n\n- Gradient\n- Brush strokes" });
  await settled(chat);
  const view = chat.view();
  assert.equal(view.rows.length, 2);
  assert.equal(view.rows[0].role, "user");
  assert.equal(view.rows[1].status, "complete");
  assert.deepEqual(view.rows[1].blocks[0].parts[1], { text: "Untitled-2", bold: true });
  assert.equal(view.rows[1].credits, 10);
  assert.equal(view.sessionUrl, AGENT_URL + "/" + state.agent_sessions[0].id);
  assert.ok(view.rows.every((r) => !r.local), "NOLGIA's own rows replaced the ones the send drew");

  // The next message goes to the same chat, as a plain turn.
  assert.equal(await chat.send("Make it warmer."), true);
  state = await mockState(mock);
  assert.equal(state.agent_creates.length, 1);
  assert.deepEqual(state.agent_submits[1], { content: "Make it warmer.", session_id: state.agent_sessions[0].id });
  await reply({ content: "Warmer now." });
  await settled(chat);
  assert.equal(chat.view().rows.length, 4);
  chat.reset();
});

test("an API without the app pin: the panel never chats unpinned", async () => {
  await mockAgent({ app_pin: false });
  const host = fakeHost();
  const chat = newChat(owner(host));
  assert.equal(await chat.send("hello"), false);
  const state = await mockState(mock);
  assert.equal(state.agent_creates.length, 1, "no second try without the pin");
  assert.equal(state.agent_submits.length, 0);
  assert.equal(chat.sessionId, null);
  assert.equal(host.remembered.chat, undefined);
  assert.match(chat.notice.text, /unknown field/);
});

test("one message is one turn: the box waits while the Agent works, and follows a turn started on nolgia.ai", async () => {
  const chat = newChat(owner());
  await chat.send("first");
  assert.equal(chat.busy, true);
  assert.equal(await chat.send("and one more thing"), false, "held while the turn runs");
  assert.equal((await mockState(mock)).agent_submits.length, 1);
  await reply({ content: "First done." });
  await settled(chat);

  // The same chat continued on nolgia.ai: its turn is running when the panel sends.
  const web = await call(mock, "POST", "/v1/agent/messages", { content: "from the website", session_id: chat.sessionId });
  assert.equal(web.status, 202);
  assert.equal(await chat.send("from the panel"), false);
  assert.match(chat.notice.text, /still working on this chat/);
  assert.equal(chat.busy, true, "the panel follows the running turn");
  await reply({ content: "Website turn done." });
  await settled(chat);
  assert.deepEqual(chat.messages().map((r) => r.role + ":" + (r.content || "")), [
    "user:first",
    "agent:First done.",
    "user:from the website",
    "agent:Website turn done.",
  ]);
  assert.equal(await chat.send("now the panel"), true);
});

test("no NOLGIA Agent yet: the panel says how to start one", async () => {
  await mockAgent({ provisioned: false });
  const chat = newChat(owner());
  await chat.start();
  assert.equal(chat.agent, null);
  assert.equal(await chat.send("hi"), false);
  assert.equal(chat.notice.kind, "no_agent");
  assert.deepEqual(chat.notice.action, { label: "Open NOLGIA Agent", url: AGENT_URL });
  assert.equal((await mockState(mock)).agent_creates.length, 0, "no empty chat is left on nolgia.ai");
  assert.equal(chat.view().sessionUrl, null);
  // Set up on nolgia.ai meanwhile: the next send reads it again and goes through.
  await mockAgent({ provisioned: true });
  assert.equal(await chat.send("hi again"), true);
  chat.reset();
});

test("out of credits, on the send or on the turn, offers Add credits", async () => {
  await mockAgent({ submit_error: { status: 402, title: "Payment Required", detail: "not enough credits", code: "insufficient_credits" } });
  let chat = newChat(owner());
  assert.equal(await chat.send("hi"), false);
  assert.deepEqual(chat.notice.action, { label: "Add credits", url: BILLING_URL });
  chat.reset();

  await mockAgent({ submit_error: null });
  chat = newChat(owner());
  await chat.send("hi");
  await reply({ status: "failed", error: "The wallet cannot pay for the turn.", error_code: "insufficient_credits" });
  await settled(chat);
  const view = chat.view();
  assert.equal(view.rows.length, 1, "the failed reply is not drawn in the thread as well");
  assert.deepEqual(view.notice, {
    kind: "credits",
    text: failureText({ status: "failed", error_code: "insufficient_credits" }),
    action: { label: "Add credits", url: BILLING_URL },
  });
  // Once a later turn settles, the old failure is a reply like any other and the card goes.
  await mockAgent({ submit_error: null });
  await chat.send("try again");
  await reply({ content: "Done." });
  await settled(chat);
  assert.equal(chat.view().notice, null);
  assert.equal(chat.view().rows[1].failure, failureText({ status: "failed", error_code: "insufficient_credits" }));
  chat.reset();
});

test("the chat is remembered: Photoshop opens on it again; a chat deleted on nolgia.ai starts a new one", async () => {
  const host = fakeHost();
  let chat = newChat(owner(host));
  await chat.send("remember me");
  await reply({ content: "Got it." });
  await settled(chat);
  const id = chat.sessionId;
  chat.reset({ forget: false });

  chat = newChat(owner(host));
  await chat.start();
  assert.equal(chat.sessionId, id);
  assert.deepEqual(chat.messages().map((r) => r.content), ["remember me", "Got it."]);
  chat.reset({ forget: false });

  // Another account on this computer does not see it.
  const other = owner(host);
  other.accountEmail = () => "someone@else.test";
  chat = newChat(other);
  await chat.start();
  assert.equal(chat.sessionId, null);
  chat.reset({ forget: false });

  host.remembered.chat = { id: "00000000-0000-4000-8000-000000000000", api: mock.baseUrl, email: "test@nolgia.ai" };
  chat = newChat(owner(host));
  await chat.start();
  assert.equal(chat.sessionId, null, "a chat deleted on nolgia.ai is forgotten");
  assert.equal(host.remembered.chat, null);
  assert.equal(await chat.send("still there?"), true);
  assert.equal((await mockState(mock)).agent_creates.length, 2, "carried on in a new chat");
  chat.reset({ forget: false });

  // A remembered chat pinned to another install (or to none) is never used here.
  const elsewhere = owner(host);
  elsewhere.instanceId = "another-install";
  chat = newChat(elsewhere);
  await chat.start();
  assert.equal(chat.sessionId, null);
  chat.reset();
});

test("Stop ends the running turn", async () => {
  const chat = newChat(owner());
  await chat.send("paint something big");
  await until(() => chat.view().canStop, { what: "Stop" });
  await chat.stop();
  await settled(chat);
  assert.equal(chat.view().rows[1].failure, "Stopped.");
  chat.reset();
});

test("only the newest reply's question takes answers", async () => {
  const chat = newChat(owner());
  await chat.send("make art");
  await reply({ content: "In Photoshop or as a new image?", question: { text: "In Photoshop or as a new image?", options: [{ label: "In Photoshop" }, { label: "A new image on NOLGIA" }] } });
  await settled(chat);
  assert.deepEqual(chat.view().rows[1].question.options.map((o) => o.label), ["In Photoshop", "A new image on NOLGIA"]);
  await chat.send("In Photoshop");
  await reply({ content: "On it." });
  await settled(chat);
  const rows = chat.view().rows;
  assert.equal(rows[1].question, null);
  chat.reset();
});

test("the poll timer runs as a plain call, as UXP's and browsers' setTimeout require", async () => {
  const real = global.setTimeout;
  let calls = 0;
  global.setTimeout = function (fn, ms) {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    calls += 1;
    return real(fn, ms);
  };
  try {
    const chat = newChat(owner());
    assert.equal(await chat.send("hi"), true);
    assert.ok(calls >= 1);
  } finally {
    global.setTimeout = real;
  }
});

test("the cost line names this account's own turn rate, read from its brain", async () => {
  // No brain chosen: the default brain's rate.
  let chat = newChat(owner());
  await chat.start();
  assert.equal(chat.view().costLine, "NOLGIA Agent works right here, each turn from 10 credits on your model. You can also use Claude Code, Cursor, Codex or another agent with NOLGIA connected.");
  // A premium brain: its rate.
  await mockAgent({ model: "claude-opus-5-5" });
  chat = newChat(owner());
  await chat.start();
  assert.equal(chat.view().costLine, "NOLGIA Agent works right here, each turn from 70 credits on your model. You can also use Claude Code, Cursor, Codex or another agent with NOLGIA connected.");
  // New chat keeps it.
  chat.newChat();
  assert.match(chat.view().costLine, /each turn from 70 credits on your model/);
  // The catalogue does not answer, or names no such brain: the site's words.
  await mockAgent({ models_error: true });
  chat = newChat(owner());
  await chat.start();
  assert.equal(chat.view().costLine, COST_LINE);
  assert.equal(turnRate({ model: "retired-brain" }, [{ model: "claude-opus-5-5", turn_credits: 70, default: false }]), null);
  // No NOLGIA Agent: the site's words.
  await mockAgent({ provisioned: false, models_error: false });
  chat = newChat(owner());
  await chat.start();
  assert.equal(chat.view().costLine, COST_LINE);
});

test("a refused sign in goes back to the controller; a long message stays in the box", async () => {
  const o = owner(fakeHost(), { token: "not-a-token" });
  const chat = newChat(o);
  assert.equal(await chat.send("hi"), false);
  assert.deepEqual(o.authFailures, ["Your NOLGIA sign in expired. Sign in again."]);
  const ok = newChat(owner());
  assert.equal(await ok.send("x".repeat(MAX_CHARS + 1)), false);
  assert.match(ok.notice.text, /too long/);
  ok.reset();
});

test("the panel's chat needs Connected and Allow NOLGIA Agent, one click each", async () => {
  const host = fakeHost({ dev: { token: TOKEN, api_url: mock.baseUrl } });
  const ctl = new Controller(host);
  await ctl.init();
  try {
    assert.equal(ctl.chatBlocker().kind, "connect");
    await ctl.fixChatBlocker();
    await until(() => ctl.connected, { what: "connected" });
    assert.equal(ctl.chatBlocker(), null);
    ctl.setSetting("allow_agent", false);
    assert.deepEqual(ctl.chatBlocker(), { kind: "allow_agent", text: "NOLGIA Agent can work here only while Allow NOLGIA Agent is on.", label: "Allow NOLGIA Agent" });
    ctl.fixChatBlocker();
    assert.equal(ctl.settings.allow_agent, true);
    assert.equal(await ctl.chat.send("hello from the panel"), true);
    const state = await mockState(mock);
    assert.equal(state.agent_creates[0].app.instance_id, "unit-instance");
  } finally {
    const worker = ctl.worker;
    ctl.disconnect();
    if (worker) await worker.finished.wait(10000);
    await ctl.signOut();
  }
  assert.equal(host.remembered.chat, null, "signing out forgets the chat on this computer");
  assert.match(COST_LINE, /^NOLGIA Agent works right here, each turn from 10 credits\./);
  assert.doesNotMatch(COST_LINE + " " + require("../core/constants.js").COST_LINE_RATE, /free/i, "the panel never says the work is free elsewhere");
});
