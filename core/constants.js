// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 NOLGIA Inc
//
// Plain JavaScript parts of the NOLGIA plugin for Photoshop.
//
// Nothing in core/ touches Photoshop or UXP, so it runs (and is tested) with
// plain Node. The Photoshop side lives in ps/ and ui/.
"use strict";

module.exports = {
  PLUGIN_VERSION: "0.2.0",
  PLUGIN_ID: "com.nolgia.photoshop",
  APP: "photoshop",
  DEFAULT_API_URL: "https://api.nolgia.ai/v1",
  DEVICE_CLIENT_ID: "nolgia-photoshop",
  DEVICE_SCOPE: "bridge assets:read assets:write",
  // nolgia.ai pages the panel opens.
  AGENT_URL: "https://nolgia.ai/agent",
  BILLING_URL: "https://nolgia.ai/billing",
  MCP_URL: "https://nolgia.ai/mcp",
  // What a NOLGIA Agent turn costs: the person's own rate when NOLGIA tells
  // it (GET /agent/models for the Agent's brain), else the site's words
  // (desktopAppCostLine).
  COST_LINE: "NOLGIA Agent turns cost from 10 credits each. With your own agent, like Claude or Cursor, the work in Photoshop is free.",
  COST_LINE_RATE: "Each NOLGIA Agent turn costs from {credits} credits on your model. With your own agent, like Claude or Cursor, the work in Photoshop is free.",
};
