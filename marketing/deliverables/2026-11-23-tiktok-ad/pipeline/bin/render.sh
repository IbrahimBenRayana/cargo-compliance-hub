#!/usr/bin/env zsh
# bin/render.sh [voice]  — the TikTok ad: picture (this folder) + sound (the promo pipeline's mixer) → .work/renders/
# Tools, voice model and music live in ../../2026-11-17-promo-videos/pipeline (see its README).
# KEEP_PICTURE=1 reuses the rendered picture and only redoes the sound.
set -e
ROOT="${0:A:h:h}"; PROMO="${ROOT:h:h}/2026-11-17-promo-videos/pipeline"; VOICE=${1:-af_heart}
R="$ROOT/.work/renders"; mkdir -p "$R"
# the one real screen: the app's narrow Today page, top 600 px of the capture
CLIP="$ROOT/composition/assets/clips/today.mp4"
[[ -f "$CLIP" ]] || { mkdir -p "${CLIP:h}"; ffmpeg -y -loglevel error -ss 2.6 -t 4.6 -i "$PROMO/.work/shots/m-dashboard/clip.mp4" -vf "crop=1440:1600:0:0,scale=900:-2" -c:v libx264 -crf 14 -pix_fmt yuv420p -an "$CLIP"; }
[[ -n "$KEEP_PICTURE" && -f "$R/tiktok-picture.mp4" ]] || (cd "$ROOT/composition" && "$PROMO/node_modules/.bin/hyperframes" render -q delivery -f 60 --video-frame-format png --crf 14 -o "$R/tiktok-picture.mp4")
cd "$PROMO"
for mix in "" "-novo"; do
  [[ -z "$mix" ]] && node audio/mix.mjs tiktok $VOICE || node audio/mix.mjs tiktok $VOICE --no-vo
  ffmpeg -y -loglevel error -i "$R/tiktok-picture.mp4" -i .work/audio/tiktok$mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 256k -shortest -movflags +faststart "$R/tiktok$mix.mp4"
done
ls -la "$R"
