#!/usr/bin/env zsh
# review/check.sh <video.mp4>  — OCR a frame every 0.25 s and fail on anything the copy rules forbid on screen.
set -e
V="$1"; OUT="${V:r}-ocr"; rm -rf "$OUT"; mkdir -p "$OUT/frames"
ffmpeg -loglevel error -i "$V" -vf "fps=4,scale='if(gt(iw,ih),1920,1080)':-1" "$OUT/frames/f%05d.png"
swiftc -O -o "$OUT/ocr" "${0:A:h}/ocr.swift" 2>/dev/null
"$OUT/ocr" "$OUT/frames" > "$OUT/text.tsv"
# deny-list: founder and company names, the gateway, the real filer code, claims the guardrails retire,
# retired prices, things that are not marketable, real mailboxes, and response-time figures
DENY='rayana|ibrahim|imran|siddique|sigma|customs ?city|gateway|\bS7P\b|certif|direct connection|type 86|section 321|in-bond|7512|\$180|\$280|free trial|sign up|@mycargolens|@sigmatech|localhost|staging|\b[0-9]{3} ms\b|AI coach off'
grep -iE "$DENY" "$OUT/text.tsv" > "$OUT/hits.tsv" || true
n=$(wc -l < "$OUT/hits.tsv" | tr -d ' ')
echo "$(wc -l < "$OUT/text.tsv" | tr -d ' ') text lines OCR'd from $(ls "$OUT/frames" | wc -l | tr -d ' ') frames; deny-list hits: $n"
[ "$n" = "0" ] || { cat "$OUT/hits.tsv" | head -20; exit 1; }
