# Sprint 9: Server Manager and a written process

- **Dates:** 2026-11-13 → 2026-11-19
- **Goal:** Hosts can run and configure the server from a friendly window, and development follows a documented Agile process in Git.
- **Planned release:** v0.19.0

| ID | Story | Points | Status |
|---|---|---|---|
| HW-090 | Server Manager window: status, start, stop, restart, players online, activity log | 8 | In review |
| HW-091 | Configure sharing on the network: port, HTTPS certificate, guild charter signatures, backups | 5 | In review |
| HW-092 | Agile process docs: process, backlog, sprint files, history | 3 | In review |
| HW-093 | Pull request template with story IDs and the Definition of Done | 1 | In review |

**Committed:** 17 points

## Acceptance criteria

**HW-090: Server Manager window.** *As a host, I want a window that shows whether my server is running and who's on it, so that I don't need a terminal.*
- **Opening it:** from the desktop app's **Server** menu (and the shortcut ⇧⌘M / Ctrl+Shift+M).
- **Status shown:** running or stopped, uptime, the address to give friends, and the players online with their level and zone.
- **Controls:** Start, Stop and Restart; the game window reconnects by itself.
- **Activity log:** server starts and stops, players coming and going, and errors.
- **Running separately:** if a development server already runs from ~/Sources, the window says so and leaves that server alone.

**HW-091: Configuration.** *As a host, I want to set up sharing without editing files, so that my friends can join.*
- **Sharing:** a "Share with my network" switch, the port, and HTTPS certificate and key chosen with file pickers.
- **Guild charters:** how many signatures they need.
- **Saving:** settings are checked (port 1024–65535, both certificate files or neither) and kept in `server-config.json`, and take effect on restart.
- **Save folder:** buttons to open it and to back up the world now.
- **Explanations:** the window explains why network play needs HTTPS.

**HW-092 / HW-093:** these documents, and `.github/pull_request_template.md`.

## Progress log
- **2026-11-13:** sprint planned. Process docs written; Sprints 1–8 reconstructed from the releases. The Server Manager and its settings module were built, with tests for the settings checks and the window's request guard. The window was checked in a browser with stand-in data ([screenshot](sprint-09-server-manager.png)); it hasn't been run in the packaged desktop app yet.

## Review
*(At the end of the sprint: PR link, accepted stories and release.)*

## Retrospective
*(At the end of the sprint.)*
