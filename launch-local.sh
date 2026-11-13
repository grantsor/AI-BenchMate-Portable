#!/usr/bin/env bash
echo "Starting AI Benchmate Portable on http://127.0.0.1:8765/"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:8765/" >/dev/null 2>&1 &
fi
python3 -m http.server 8765 --bind 127.0.0.1
