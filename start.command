#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Hearthwild requires Node.js 22 or newer. Install Node.js, then run this file again.'
  read -r '?Press Enter to close.'
  exit 1
fi
printf 'Open http://127.0.0.1:4180 in your browser. Press Ctrl-C here to stop the server.\n'
node server/http.js
