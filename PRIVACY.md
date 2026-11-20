# Privacy policy

*Draft for review: 2026-11-20. Have it checked by a lawyer before Hearthwild offers paid or hosted services.*

Hearthwild collects as little as it can. This policy covers the Hearthwild game, the desktop app and the demo, and any Hearthwild world run by the project itself. **If you play on a world someone else hosts** (a friend's app, a home server, a community server), that host runs the server and is responsible for it; this policy describes what the software stores, so you know what they can see.

## What the server stores

| What | Why | How long |
|---|---|---|
| **Username** | To sign you in and show who you are | Until the account is deleted |
| **Password**, stored only as a salted scrypt hash, never in readable form | To check your password | Until the account is deleted or the password changed |
| **Sign-in sessions**, stored as hashes | To keep you signed in | Until you sign out or the host signs everyone out |
| **Characters and progress**: names, class, faction, level, items, gold, quests, achievements, guild, position | To play the game | Until the character or account is deleted |
| **Letters you send** in the game's mail | To deliver them | Up to 30 days unread, or until the recipient deletes them |
| **Moderation records**: whether an account is banned, the reason, and when | To keep the world safe | Until the ban is lifted |
| **Date the account was created** | Moderation and support | Until the account is deleted |

## What it doesn't store

- **Chat** is kept in memory for people currently online (the last 80 messages each) and is gone when the server restarts. It isn't written to disk.
- **IP addresses** are held in memory only, briefly, to limit how fast one address can send requests and sign-in attempts. They aren't saved.
- There's **no email address, real name, payment card, analytics, advertising or tracking**. The game and the desktop app don't send data anywhere except to the game server you connect to. The desktop app opens your web browser only when you click a link (the source code or the full game).

## Who can see it

- **Other players** see your character's name, title, guild, level, class and what it's doing, but only near you, and chat only within your faction.
- **The host** can see everything listed above, because it's stored on their computer. They can't read your password. The Server Manager shows them who's online and lets them kick, ban, or reset a password.
- Nobody else. The project doesn't sell or share data.

## Your choices

- To see, correct or delete your account and characters, ask the host of your world. On a world run by the project, open an issue at [github.com/drakeg/hearthwild/issues](https://github.com/drakeg/hearthwild/issues) (don't post personal details there) or contact the maintainer through GitHub. We'll reply within 30 days.
- Children under 13 shouldn't make an account on a world run by the project.

## Security

Passwords are hashed with scrypt and a unique salt. Signing in over a network requires HTTPS, and sign-in attempts are rate-limited. Report security problems privately as described in [SECURITY.md](SECURITY.md).

## Changes

Changes to this policy are listed in [CHANGELOG.md](CHANGELOG.md) and in this file's history on GitHub. If hosted or paid services launch, this policy will be updated first, to cover what they need (for example, a payment provider).
