# Prints the CHANGELOG section for one version, plus download instructions.
import re, sys
v = sys.argv[1]
s = open("CHANGELOG.md", encoding="utf-8").read()
m = re.search(r"## " + re.escape(v) + r"\b.*?\n(.*?)(?=\n## |\Z)", s, re.S)
print(m.group(1).strip() if m else f"Hearthwild {v}")
print(f"""
## Downloads

| System | File |
|---|---|
| macOS (Apple Silicon: M1 or later) | `Hearthwild-{v}-Mac-Apple-Silicon.pkg` |
| macOS (Intel) | `Hearthwild-{v}-Mac-Intel.pkg` |
| Windows 10/11 (64-bit) | `Hearthwild-{v}-Windows-x64.zip`: unzip, then run `Hearthwild.exe` |
| Linux (64-bit) | `Hearthwild-{v}-Linux-x64.tar.gz`: extract, then run `./hearthwild` |

**Free demo** (the Stillwood, up to level 6; installs alongside the full game with its own save): `Hearthwild-Demo-{v}-Mac-Apple-Silicon.pkg`, `Hearthwild-Demo-{v}-Mac-Intel.pkg`, `Hearthwild-Demo-{v}-Windows-x64.zip` (run `Hearthwild Demo.exe`), `Hearthwild-Demo-{v}-Linux-x64.tar.gz` (run `./hearthwild-demo`).

These builds are not signed by a registered developer. On macOS, right-click the installer and choose **Open**. On Windows, choose **More info → Run anyway** if SmartScreen appears. Checksums are in `SHA256SUMS.txt`.""")
