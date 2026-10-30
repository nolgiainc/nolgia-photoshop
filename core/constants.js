// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 NOLGIA Inc
//
// Plain JavaScript parts of the NOLGIA plugin for Photoshop.
//
// Nothing in core/ touches Photoshop or UXP, so it runs (and is tested) with
// plain Node. The Photoshop side lives in ps/ and ui/.
"use strict";

module.exports = {
  PLUGIN_VERSION: "0.2.4",
  PLUGIN_ID: "com.nolgia.photoshop",
  APP: "photoshop",
  DEFAULT_API_URL: "https://api.nolgia.ai/v1",
  DEVICE_CLIENT_ID: "nolgia-photoshop",
  DEVICE_SCOPE: "bridge assets:read assets:write",
  // nolgia.ai pages the panel opens.
  AGENT_URL: "https://nolgia.ai/agent",
  BILLING_URL: "https://nolgia.ai/billing",
  MCP_URL: "https://nolgia.ai/mcp",
  // The line under the chat box: NOLGIA Agent first, with what a turn costs
  // on the person's own model (GET /agent/models for the Agent's brain), or
  // the lowest rate when NOLGIA does not say; then the agents NOLGIA's MCP
  // page documents (nolgia.ai/mcp), as the owner lists them: Claude, Cursor,
  // Codex (the same words as the Blender and Resolve panels).
  COST_LINE: "NOLGIA Agent works right here, each turn from 10 credits. You can also use Claude, Cursor, Codex or another agent with NOLGIA connected.",
  COST_LINE_RATE: "NOLGIA Agent works right here, each turn from {credits} credits on your model. You can also use Claude, Cursor, Codex or another agent with NOLGIA connected.",
};
