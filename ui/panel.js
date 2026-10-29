// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 NOLGIA Inc
//
// The NOLGIA panel: shows the controller's state and turns clicks into
// controller calls. Plain DOM, so it works in UXP without a framework.
"use strict";

const { ActivityLog } = require("../core/commands.js");
const { AGENT_URL, COST_LINE } = require("../core/constants.js");

const CHIP_TEXT = {
  off: "Off",
  connecting: "Connecting",
  connected: "Connected",
  retrying: "Retrying",
  signed_out: "Signed out",
  approval: "Needs you",
};

const MAX_CODE_CHARS = 20000;

/** What the chat suggests before the first message: things this plugin and
 *  NOLGIA's Photoshop workflows do. A click puts one in the box. */
const EXAMPLES = [
  "Make an abstract painting in a new document with my current brush and colors.",
  "Clean up this image: remove what does not belong, each fix on its own layer.",
  "Add a soft film grain layer to this photo and warm up its colors.",
];

const LINK_WHY = "Open this NOLGIA page in your browser.";

function pad(n) {
  return String(n).padStart(2, "0");
}

function clock(seconds) {
  const d = new Date(seconds * 1000);
  return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

/** classList.toggle with a force flag, spelled out for older UXP. */
function setClass(el, name, on) {
  if (!el) return;
  if (on) el.classList.add(name);
  else el.classList.remove(name);
}

function createPanel(controller, doc) {
  const $ = (id) => doc.getElementById(id);
  const show = (id, visible) => {
    const el = $(id);
    setClass(el, "hidden", !visible);
  };
  const on = (id, fn) => {
    const el = $(id);
    if (el) {
      el.addEventListener("click", () => {
        try {
          const out = fn();
          if (out && typeof out.catch === "function") out.catch((err) => controller.log("Panel action failed: " + err));
        } catch (err) {
          controller.log("Panel action failed: " + err);
        }
      });
    }
  };

  on("btn-sign-in", () => controller.signIn());
  on("btn-cancel-sign-in", () => controller.cancelSignIn());
  on("btn-open-page", () => controller.login && controller.login.prompt && controller.host.openUrl(controller.login.prompt.openUrl));
  on("btn-copy-code", () => controller.login && controller.login.prompt && controller.host.copyText(controller.login.prompt.userCode));
  on("btn-sign-out", () => controller.signOut());
  on("btn-pause", () => controller.togglePause());
  on("tg-connected", () => (controller.connected ? controller.disconnect() : controller.connect()));
  on("tg-allow-agent", () => controller.setSetting("allow_agent", !controller.settings.allow_agent));
  on("tg-ask", () => controller.setSetting("ask_before_run", !controller.settings.ask_before_run));
  on("btn-approve", () => {
    const pending = controller.executor.approvals[0];
    if (pending) controller.approve(pending.id);
  });
  on("btn-deny", () => {
    const pending = controller.executor.approvals[0];
    if (pending) controller.deny(pending.id);
  });

  const openLink = (url) => {
    if (!/^https:\/\//.test(String(url || ""))) return;
    Promise.resolve(controller.host.openUrl(url, LINK_WHY)).catch((err) => controller.log("Could not open " + url + " (" + err + ")."));
  };
  const input = $("chat-input");

  function sendFromBox() {
    if (!input || controller.chatBlocker() || controller.chat.busy) return;
    const text = String(input.value || "");
    if (!text.trim()) return;
    controller.chat.send(text).then((sent) => {
      if (sent && input.value === text) input.value = "";
    });
  }

  on("btn-send", sendFromBox);
  on("btn-stop", () => controller.chat.stop());
  on("btn-new-chat", () => controller.chat.newChat());
  on("btn-open-agent", () => openLink(AGENT_URL));
  on("chat-open-web", () => {
    const url = controller.chat.view().sessionUrl;
    if (url) openLink(url);
  });
  on("btn-chat-fix", () => controller.fixChatBlocker());
  on("btn-chat-notice", () => {
    const notice = controller.chat.view().notice;
    if (notice && notice.action) openLink(notice.action.url);
  });
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        try {
          event.preventDefault();
        } catch (err) {
          // a newline at the end is trimmed anyway
        }
        sendFromBox();
      }
    });
    input.addEventListener("focus", () => controller.chat.wake());
  }

  const examples = $("chat-examples");
  if (examples) {
    for (const text of EXAMPLES) {
      const el = doc.createElement("div");
      el.className = "example";
      el.textContent = text;
      el.addEventListener("click", () => {
        if (input) {
          input.value = text;
          try {
            input.focus();
          } catch (err) {
            // focus is a nicety
          }
        }
      });
      examples.appendChild(el);
    }
  }
  const cost = $("chat-cost");
  if (cost) cost.textContent = COST_LINE;

  /** One piece of a reply: text, bold text or a link. */
  function part(p) {
    const el = doc.createElement("span");
    el.textContent = p.text;
    if (p.bold) el.className = "bold";
    if (p.href) {
      el.className = "href";
      el.title = p.href;
      el.addEventListener("click", () => openLink(p.href));
    }
    return el;
  }

  function messageNode(row) {
    const box = doc.createElement("div");
    box.className = "msg " + (row.role === "user" ? "user" : "agent");
    const who = doc.createElement("div");
    who.className = "who";
    who.textContent = row.role === "user" ? (row.background ? "BACKGROUND WORK FINISHED" : "YOU") : "NOLGIA AGENT";
    box.appendChild(who);
    if (row.role === "user") {
      const text = doc.createElement("div");
      text.className = "text";
      text.textContent = row.text;
      box.appendChild(text);
      return box;
    }
    if (row.status === "pending") {
      const text = doc.createElement("div");
      text.className = "text";
      text.textContent = row.queued ? "Waiting for a free turn..." : "Working...";
      box.appendChild(text);
      return box;
    }
    for (const block of row.blocks || []) {
      const el = doc.createElement("div");
      el.className = block.type === "li" ? "li" : "para";
      if (block.type === "li") el.appendChild(part({ text: "\u2022 " }));
      for (const p of block.parts) el.appendChild(part(p));
      box.appendChild(el);
    }
    if (row.failure) {
      const el = doc.createElement("div");
      el.className = "para failure";
      el.textContent = row.failure;
      box.appendChild(el);
    }
    if (row.action) {
      const btn = doc.createElement("div");
      btn.className = "btn small";
      btn.textContent = row.action.label;
      btn.addEventListener("click", () => openLink(row.action.url));
      box.appendChild(btn);
    }
    if (row.question && row.question.options.length) {
      const options = doc.createElement("div");
      options.className = "options";
      for (const option of row.question.options) {
        const btn = doc.createElement("div");
        btn.className = "btn small";
        btn.textContent = option.label;
        btn.addEventListener("click", () => {
          if (!controller.chatBlocker() && !controller.chat.busy) controller.chat.send(option.label);
        });
        options.appendChild(btn);
      }
      box.appendChild(options);
    }
    if (row.credits !== null && row.status === "complete") {
      const meta = doc.createElement("div");
      meta.className = "meta";
      meta.textContent = row.credits + " credits";
      box.appendChild(meta);
    }
    return box;
  }

  let shownThread = null;
  function renderChat() {
    const signedIn = controller.signedIn && !controller.login;
    show("chat", signedIn);
    if (!signedIn) {
      shownThread = null;
      return;
    }
    const view = controller.chat.view();
    const blocker = controller.chatBlocker();
    show("chat-intro", view.loaded && view.empty);
    show("btn-new-chat", !view.empty);

    const signature = JSON.stringify([view.hidden, view.rows]);
    if (signature !== shownThread) {
      const thread = $("chat-thread");
      while (thread.firstChild) thread.removeChild(thread.firstChild);
      if (view.hidden) {
        const more = doc.createElement("div");
        more.className = "hint";
        more.textContent = "Earlier messages are on nolgia.ai.";
        thread.appendChild(more);
      }
      for (const row of view.rows) thread.appendChild(messageNode(row));
      shownThread = signature;
      try {
        thread.scrollTop = thread.scrollHeight;
      } catch (err) {
        // scrolling is a nicety
      }
    }
    show("chat-thread", view.rows.length > 0);

    show("chat-working", Boolean(view.working));
    $("chat-working").textContent = view.working || "";

    const notice = view.notice;
    show("chat-notice", Boolean(notice));
    $("chat-notice-text").textContent = notice ? notice.text : "";
    show("btn-chat-notice", Boolean(notice && notice.action));
    $("btn-chat-notice").textContent = notice && notice.action ? notice.action.label : "";

    show("chat-blocker", Boolean(blocker));
    $("chat-blocker-text").textContent = blocker ? blocker.text : "";
    $("btn-chat-fix").textContent = blocker ? blocker.label : "";

    // One message is one turn: the box waits while the Agent works.
    const canSend = !blocker && !view.busy;
    setClass($("btn-send"), "disabled", !canSend);
    $("btn-send").textContent = controller.chat.sending ? "Sending..." : "Send";
    show("btn-stop", view.canStop);
    show("chat-open-web", Boolean(view.sessionUrl));
  }

  let shownCode = null;

  function render() {
    const state = controller.statusState();
    const dot = $("chip-dot");
    dot.className = "dot " + state;
    $("chip-text").textContent = CHIP_TEXT[state] || state;
    $("status").textContent = controller.statusLine();

    const login = controller.login;
    const signedIn = controller.signedIn;
    show("signin", !login && !signedIn);
    show("login", Boolean(login));
    if (login) $("login-code").textContent = login.prompt ? login.prompt.userCode : "....-....";
    show("btn-open-page", Boolean(login && login.prompt));
    show("btn-copy-code", Boolean(login && login.prompt));

    show("account", !login && signedIn);
    if (signedIn) {
      const email = controller.accountEmail();
      $("account-line").textContent = email
        ? "Signed in as " + email
        : controller.usingDevToken
          ? "Signed in with a developer token file"
          : "Signed in";
    }
    setClass($("tg-connected"), "on", controller.connected);
    setClass($("tg-allow-agent"), "on", Boolean(controller.settings.allow_agent));
    setClass($("tg-ask"), "on", Boolean(controller.settings.ask_before_run));

    const pending = controller.executor.approvals[0];
    show("approval", Boolean(pending));
    if (pending) {
      $("approval-title").textContent = pending.request.title;
      $("btn-approve").textContent = pending.request.approveLabel;
      if (shownCode !== pending.id) {
        const code = pending.request.code || pending.request.lines.join("\n");
        $("approval-code").textContent = code.length > MAX_CODE_CHARS ? code.slice(0, MAX_CODE_CHARS) + "\n..." : code;
        shownCode = pending.id;
      }
    } else {
      shownCode = null;
    }

    show("btn-pause", signedIn);
    $("btn-pause").textContent = controller.connected ? "Pause" : "Resume";
    const list = $("activity-list");
    while (list.firstChild) list.removeChild(list.firstChild);
    const items = controller.activity.items();
    if (!items.length) {
      const empty = doc.createElement("div");
      empty.className = "empty";
      empty.textContent = "Nothing yet.";
      list.appendChild(empty);
    }
    for (const item of items) {
      const row = doc.createElement("div");
      row.className = "item";
      if (item.detail && item.status !== "succeeded") row.title = item.detail;
      const time = doc.createElement("div");
      time.className = "time";
      time.textContent = clock(item.time);
      const kind = doc.createElement("div");
      kind.className = "kind";
      kind.textContent = item.kind + (item.caller === "agent" ? "  (NOLGIA Agent)" : "");
      const status = doc.createElement("div");
      status.className = "state " + item.status;
      status.textContent = ActivityLog.STATUS_LABELS[item.status] || item.status;
      row.appendChild(time);
      row.appendChild(kind);
      row.appendChild(status);
      list.appendChild(row);
    }

    renderChat();

    const dev = controller.dev;
    $("dev-line").textContent = dev ? "Developer file in use: " + controller.apiUrl : "";
    show("dev-line", Boolean(dev));
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      try {
        render();
      } catch (err) {
        controller.log("Could not draw the panel: " + err);
      }
    }, 30);
  }

  controller.onChange(schedule);
  render();
  return { render, schedule };
}

module.exports = { createPanel, CHIP_TEXT, EXAMPLES };
