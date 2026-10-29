# NOLGIA for Photoshop

NOLGIA's plugin for Photoshop. It connects Photoshop on your computer to
NOLGIA, so NOLGIA Agent can look at your project, make changes in it, render
previews and move files between the app and your NOLGIA library. Since 0.2.2
the NOLGIA panel has a chat: type what you want done in this Photoshop and
NOLGIA Agent does it here. Claude, Cursor, Codex and other agents
connected to NOLGIA's MCP server reach the same commands.

```
your agent --MCP--> mcp.nolgia.ai --> api.nolgia.ai <--(the plugin connects out)-- Photoshop on your computer
the panel's chat -----------------> api.nolgia.ai --> your NOLGIA Agent (works in this Photoshop the same way)
```

The plugin always connects out to NOLGIA; nothing connects in to your
computer. It only takes commands while you are signed in and have it switched
on, and it lists every command it runs.

A UXP plugin for Photoshop 2024 (25.0) and newer, tested on Windows with
Photoshop 2026 (27.5) and on macOS 26.6.2 (Apple silicon) with Photoshop 2026
(27.11): see "Tested on" below.

## Install and use

1. Get `nolgia-photoshop-<version>.ccx` from [nolgia.ai/plugins/photoshop](https://nolgia.ai/plugins/photoshop)
   (or the [releases](https://github.com/nolgiainc/nolgia-photoshop/releases) here).
2. Double-click the file. Creative Cloud installs it into Photoshop after you
   confirm a plugin from outside the Adobe Marketplace. On Windows the
   installer also runs from a command prompt:
   `"C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe" /install nolgia-photoshop-<version>.ccx`
   (and `/remove "NOLGIA for Photoshop"` takes it out again).
   Updating while Photoshop is open: the installer says it succeeded, but
   Photoshop keeps running the version it loaded until you restart it (seen
   on Windows with Photoshop 2026, 27.5, installing 0.2.0 over 0.1.0). Save
   your work and restart Photoshop to load the new version.
3. In Photoshop, open the NOLGIA panel from the Plugins menu (under NOLGIA
   for Photoshop).
4. Click Sign in. Your browser opens a NOLGIA page; check that the code
   matches the one in the panel and approve it.
5. Keep Connected on and tell NOLGIA Agent what to do in the panel's chat
   box. Claude, Cursor, Codex or another agent with NOLGIA connected can
   work here too.
   Each command shows up in the Activity list. Click Pause (or turn
   Connected off) to stop at any time.

Photoshop loads the plugin when it starts, so NOLGIA reconnects by itself
when you left Connected on, even with the panel closed.

Settings in the NOLGIA panel:

- **Connected**: NOLGIA can send commands to this Photoshop only while this is on.
- **Allow NOLGIA Agent**: also let your NOLGIA Agent in the cloud work here, not
  only the agent apps you run yourself.
- **Ask before running code**: show every piece of code NOLGIA wants to run, in
  a window and in the panel, and wait for you to click Run code or Deny.
- **Sign out**: disconnect and forget the sign in on this computer (the token
  is kept in UXP secure storage, encrypted by your system).

## The chat in the panel

The NOLGIA AGENT card is a chat with your NOLGIA Agent, the same Agent and
the same chats as nolgia.ai/agent:

- Before your first message it suggests a few things to ask (a click puts one
  in the box), and offers Open NOLGIA Agent (the same chats on nolgia.ai).
- Your first message starts a chat pinned to this Photoshop (`app` on
  `POST /agent/sessions`: `photoshop` and this install's `instance_id`), so
  every turn tells the Agent you are writing from this Photoshop and that
  your requests are about it. It shows on nolgia.ai as "Photoshop: " and
  your first words. The panel remembers it; New chat starts another. A chat
  that is not pinned to this install is never used here.
- One message is one turn: while the Agent works, the box waits ("NOLGIA
  Agent is working"), and Stop ends the turn. What it does in Photoshop
  shows in the Activity list as usual. The reply comes back in the panel
  with what the turn cost.
- It needs Connected and Allow NOLGIA Agent on (the Agent reaches this
  Photoshop through them); when one is off the card says so, with one button
  that turns it on.
- **Cost:** the line under the box puts NOLGIA Agent first, with what a turn
  costs on your Agent's model: "NOLGIA Agent works right here, each turn
  from N credits on your model", read from `GET /agent/models` for the
  brain `GET /agent` names (from 10 credits when NOLGIA does not say). Then
  "You can also use Claude, Cursor, Codex or another agent with NOLGIA
  connected" (the agents nolgia.ai/mcp documents). Each reply shows what it
  cost.
- **Scrolling:** the panel is one scroller at any size, so the mouse wheel
  works anywhere over it. Photoshop gives a panel no wheel events and does
  not pass the wheel on from an inner scroller that reached its end, so
  nothing inside scrolls on its own:
  - the thread shows the newest 10 messages, and older ones open on
    nolgia.ai;
  - Activity shows the newest 5 commands, with Show all;
  - a new reply scrolls the panel to its start, unless you scrolled the
    panel yourself.
- **No Agent or no credits:** if your account has no NOLGIA Agent yet, or no
  credits left, the card says so, with a link to nolgia.ai.

The chat uses the sign in the panel already has; it asks for nothing new.

Code that NOLGIA runs in Photoshop runs on your computer with your
permissions, like any plugin or script. Turn on Ask before running code if
you want to see it first. The plugin asks Photoshop for: network access to
api.nolgia.ai and NOLGIA's file storage (storage.googleapis.com), full file
access (to open, save and export where your agent asks), opening https links
(the sign in page, and nolgia.ai pages the chat links to), the clipboard
(Copy code) and running code from text (the `run` command).

## What your agent can do

The MCP tools `nolgia_app_info`, `nolgia_app_run`, `nolgia_app_preview`,
`nolgia_app_import` and `nolgia_app_export` reach these commands; `save` and
`open` are there for callers of the API (and for code in `run`).

| Command | Arguments | Result |
|---|---|---|
| `info` | none | open documents (name, path, unsaved changes, active); for the active one: size, resolution, colour mode, bit depth, colour profile, the layer tree (id, name, kind, visibility, opacity, blend mode, layer and vector masks, bounds, locks, groups with their layers), the selected layers, the selection's bounds and the last History step |
| `run` | `language: "uxp"`, `code`, `timeout_seconds?` | `{value, stdout, stderr}`. The code is the body of an async function (so it can `await`); `value` is what it puts in `result` (or `return`s). It sees `app`, `core`, `action`, `batchPlay`, `play` (batchPlay that throws when a step fails), `constants`, `imaging`, `photoshop`, `uxp`, `fs` (the local file system), `formats`, `doc` (the active document), `modal(fn)`, `sleep(ms)`, `require` and a `console` whose output is returned. A failure returns the error with the line of your code it happened on. |
| `preview` | `width?` (16 to 1920), `region?` (`{left, top, right, bottom}` in pixels), `document?` | a flattened copy of the document (visible layers), never larger than it is, uploaded: `{asset_id, width, height, mime_type}`. A PNG, or a JPEG when the PNG would be too big for your agent to see inline (about 3.6 MB). |
| `import_asset` | `asset_id`, `as?` (`layer`, `pixels`, `document`), `name?` | brings a NOLGIA image in: by default as a Smart Object layer right above the selected layer, or as a new document when none is open. An image with the document's shape is scaled to cover the canvas exactly; anything else is centred. The selection is kept. `{imported, kind, layer_id, group, placement, bounds}` |
| `export` | `format` (`png`, `jpg`, `psd`), `filename?`, `quality?` (jpg, 1 to 12), `document?` | a flattened full-size `png` or `jpg`, uploaded: `{asset_id, format, filename, width, height}`. `psd` saves a copy on this computer instead (next to the open file, or in Documents/NOLGIA exports while it is unsaved) and never overwrites a file: `{asset_id: null, path, note}`. Photoshop files are not uploaded to NOLGIA. |
| `save` | `path?`, `document?` | saves the document; without `path` only to the file it already has; with `path` as a `.psd` or `.psb`: `{path}` |
| `open` | `path` | opens a file in a new document tab: `{path, document, id}` |

Photoshop only lets a plugin change a document inside `executeAsModal`.
Every `run` already runs inside it, as one step in Photoshop's History named
"NOLGIA: run code" (one Undo takes it back), and a run that fails is undone.
So agent code edits the document directly:

```js
const layer = await doc.layers.add({ name: "Grain" });
await play([{ _obj: "fill", using: { _enum: "fillContents", _value: "gray" },
              opacity: { _unit: "percentUnit", _value: 100 }, mode: { _enum: "blendMode", _value: "normal" } }]);
layer.blendMode = constants.BlendMode.OVERLAY;
result = { id: layer.id };
```

Use the `modal(async (ctx) => ...)` helper, not `core.executeAsModal`, if
code needs a scope of its own: an error thrown inside `executeAsModal` comes
back as bare text without a line number. The pitfalls Photoshop scripting has
(where new layers land, batchPlay not throwing, and more) are in
[`presets/photoshop/_common.md`](presets/photoshop/_common.md).

## Known limits

- Photoshop gives a plugin no time to reach the network when it quits, so
  NOLGIA only notices a closed Photoshop when it stops checking in (about a
  minute). A command sent in that minute waits until it expires.
- A long poll the plugin gave up on can stay open on NOLGIA's side for up to
  25 seconds (Google's front end keeps it), and would take the next command.
  So after Pause and Resume, or a quick restart, the plugin waits for that
  poll to run out before it connects again ("Reconnecting to NOLGIA...").
- Photoshop's Generative Fill has no scripting interface the plugin supports.

## Tested on

- **0.2.3:** fixes from the owner's Mac test of 0.2.2. The panel reports the
  computer's own name (on a Mac the Computer Name from System Settings >
  General > About, read from macOS's SystemConfiguration preferences; on
  Windows the name the other NOLGIA plugins found, as UXP cannot ask
  Windows) and its operating system, and the sign in page names Photoshop.
  Unit tests on Windows; on macOS it waits for its re-test.
- **0.2.2 on macOS:** macOS 26.6.2 (Apple silicon) with Photoshop 2026
  (27.11.0), against the real NOLGIA API, on October 29, 2026. Installed
  with Adobe's installer (no NOLGIA plugin before), signed in and
  connected; the request "Make an abstract art in my photoshop, using default
  colors and brushes and tools." from the panel's chat painted in the
  document (70 credits); the working state with Stop, the reply in the
  panel, Activity and the panel scrolling down to Sign out all passed. It
  showed the computer's name as "louieknows's Mac" (fixed in 0.2.3).
- **Release numbers:** 0.2.0 and 0.2.1 were never released. They were
  builds tried in Photoshop, and an installed build of a version can't be
  replaced by another build of the same version while Photoshop has it
  loaded.
- **0.2.2:** Windows 11 with Photoshop 2026 (27.5), against the real NOLGIA
  API, on October 29, 2026. This exact build was installed with Adobe's
  installer. Updating while Photoshop is open: see Install and use. Checked
  there:
  - **Sign in:** the panel signed in and connected.
  - **Cost line:** gives this account's rate: "each turn from 70 credits on
    your model".
  - **Wheel:** scrolled the panel with the cursor over the thread, over
    Activity and over the box, at 241x320 (the minimum), 321x600 and 391x798
    (floating). With the cursor held mid panel, it went from the top to the
    end at each size.
  - **Activity:** shows 5 commands, with Show all and Show fewer.
  - **No Agent turn on 0.2.2 itself:** the send and reply path is the one
    the 0.2.0 build ran below.
- **The chat, first run as the unreleased 0.2.0 build:** Windows 11 with
  Photoshop 2026 (27.5), against the real NOLGIA API, on October 29, 2026:
  - **Install:** 0.2.0 went in with Adobe's installer over 0.1.0. It loaded
    after a Photoshop restart, with the sign in and settings kept.
  - **The test:** the panel opened from the Plugins menu, and the request
    "Make an abstract art in my photoshop, using default colors and brushes
    and tools." was typed in its box and sent. NOLGIA Agent painted it in
    the open document through the plugin (info, a PSD safety copy, four
    runs, a preview). The reply came back in the panel: 70 credits, about
    100 s.
  - **Also seen there:** the suggestions, the working state with Stop, and
    the Allow NOLGIA Agent notice.
  - **Three layout fixes found there:** the box's left margin, the colour of
    a held Send, and scrolling to the start of a reply. They were checked as
    live style changes in that panel.
- **0.1.0, everything else:** Windows with Photoshop 2026 (27.5) and macOS
  26.6 (Apple silicon) with Photoshop 2026 (27.11), against the mock API.

## Development

The parts that do not need Photoshop live in
[`core/`](core/) (plain JavaScript, no dependencies) and
have unit tests that run with Node 18 or newer against the mock API from
[`tools/mock_bridge_server.py`](tools/mock_bridge_server.py) (so Python 3.8+
too):

```sh
node --test tests/*.test.js
```

Build the installable `.ccx` (Python 3, standard library):

```sh
python3 build.py                    # dist/nolgia-photoshop-0.2.3.ccx
python3 build.py --dev-domain http://localhost:8791
                                              # a test build that may also reach a local mock API
```

Releases are tagged `photoshop-v<version>` with the file attached as
`nolgia-photoshop-<version>.ccx`.

The end-to-end test runs on Windows (from Windows or from WSL) and on macOS. It builds the
plugin, installs it with Adobe's installer, starts Photoshop (which must be
closed first), drives every command through the API as an agent would,
checks the results, the files and the uploaded images, signs in with the
device flow, restarts Photoshop to check the saved sign in reconnects, and
closes it again:

```sh
python3 tests/e2e_photoshop.py                  # against the mock API
python3 tests/e2e_photoshop.py --prod --token-file ~/.config/nolgia/tokens.json
```

`--prod` uses the real API with your token: it uploads a few small test
images to your library and signs in one more device session. Nothing costs
credits. The test's macOS support changed how it drives Photoshop on Windows
too; it has not been run on Windows since.

Scripts and tests connect without clicks through a developer file,
`nolgia-dev.json` in the plugin's data folder, read when Photoshop starts
(on Windows
`%APPDATA%\Adobe\UXP\PluginsStorage\PHSP\<Photoshop major version>\External\com.nolgia.photoshop\PluginData`;
the plugin writes the folder it uses to the UXP log at startup, in a line
starting `NOLGIA: data folder:`). The panel says when a developer file is in
use. Delete it when you are done.

| Key | Effect |
|---|---|
| `token` | use this token instead of signing in (never saved) |
| `api_url` | API to talk to (default `https://api.nolgia.ai/v1`); a saved sign in is only ever sent to the API it came from |
| `autoconnect` | connect as soon as Photoshop starts |
| `ask_before_run`, `allow_agent` | set those settings |
| `instance_id` | fixed session id for this Photoshop |
| `show_panel` | open the NOLGIA panel at startup (test builds only) |
| `export_dir` | where `export` `psd` puts copies of unsaved documents |
| `preview_max_bytes` | the size above which previews become JPEG |

The plugin writes what it does to Photoshop's UXP log
(`%APPDATA%\Adobe\Adobe Photoshop <year>\Logs\UXPLogs_*.log` on Windows),
each line starting with `NOLGIA:`.

## This repository

| Path | What it holds |
|---|---|
| [`manifest.json`](manifest.json), [`index.html`](index.html), [`main.js`](main.js), [`styles.css`](styles.css), [`ui/`](ui/), [`ps/`](ps/), [`icons/`](icons/) | The UXP plugin |
| [`core/`](core/) | The parts that do not need Photoshop (plain JavaScript, no dependencies) |
| [`build.py`](build.py) | Builds the installable .ccx |
| [`tests/`](tests/) | Unit tests and the end-to-end test |
| [`presets/photoshop/`](presets/photoshop/) | The Film assistant workflows for Photoshop and the rules they share |
| [`tools/mock_bridge_server.py`](tools/mock_bridge_server.py) | An in-memory mock of the NOLGIA API that the tests run against |

The mock API is the same file in every NOLGIA plugin repository ([Blender](https://github.com/nolgiainc/nolgia-blender), [After Effects, Premiere Pro and Illustrator](https://github.com/nolgiainc/nolgia-adobe), [Photoshop](https://github.com/nolgiainc/nolgia-photoshop) and [DaVinci Resolve](https://github.com/nolgiainc/nolgia-resolve));
copy a change to it into the others.

This plugin used to live in the `photoshop/` folder of
[nolgiainc/nolgia-plugins](https://github.com/nolgiainc/nolgia-plugins), with
the other NOLGIA plugins. On October 16, 2026 it moved here with its history,
its branches and its releases. The releases on nolgia-plugins stay where they
are, so links to them keep working. Issues and pull requests belong here.

## License

GPL-3.0-or-later ([`LICENSE`](LICENSE)).
