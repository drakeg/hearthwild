# Security

Hearthwild runs a game server that people sign in to, so security problems matter.

## Reporting a problem

**Please don't open a public issue.** Report it privately using GitHub's **"Report a vulnerability"** button on the repository's *Security* tab. Include:
- what the problem is, and what someone could do with it;
- the steps to reproduce it, and the version affected.

You'll get a reply as soon as the owner can, and credit in the release notes if you'd like it.

## Supported versions

Only the latest release gets security fixes.

## Already in place

- Passwords are hashed with scrypt, and sign-in is rate-limited.
- Sign-in from other computers requires HTTPS.
- The server rejects requests from other origins and limits the size of every request.
- The desktop app's windows are sandboxed. The Server Manager answers only its own window.
