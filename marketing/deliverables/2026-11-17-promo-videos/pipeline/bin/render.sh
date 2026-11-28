#!/usr/bin/env zsh
# bin/render.sh <promo|promo-square|vertical|isf> [voice]  — picture + mixes → .work/renders/<cut>-*.mp4
#   promo, isf     4K60 master, a 1080p copy, each with voiceover and music-only
#   promo-square   2160 master, 1080x1080 copy (same sound as promo)
#   vertical       1080x1920, music and captions only
# KEEP_PICTURE=1 reuses the rendered picture and only redoes sound and the small copies.
set -e
ROOT="${0:A:h:h}"; cd "$ROOT"
CUT=${1:-promo}; VOICE=${2:-af_heart}; R=.work/renders; mkdir -p $R
node composition/build.mjs $CUT
[[ -n "$KEEP_PICTURE" && -f $R/$CUT-picture.mp4 ]] || (cd composition && ../node_modules/.bin/hyperframes render -q delivery -f 60 --video-frame-format png --crf 14 -o ../$R/$CUT-picture.mp4)
case $CUT in
  vertical) MIXES=("-novo"); SMALL="1080:1920" ;;
  promo-square) MIXES=("" "-novo"); SMALL="1080:1080" ;;
  *) MIXES=("" "-novo"); SMALL="1920:1080" ;;
esac
for mix in "${MIXES[@]}"; do
  [[ -z "$mix" ]] && node audio/mix.mjs $CUT $VOICE || node audio/mix.mjs $CUT $VOICE --no-vo
  ffmpeg -y -loglevel error -i $R/$CUT-picture.mp4 -i .work/audio/$CUT$mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $R/$CUT$mix-master.mp4
  ffmpeg -y -loglevel error -i $R/$CUT$mix-master.mp4 -vf "scale=${SMALL}:flags=lanczos" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -c:a copy -movflags +faststart $R/$CUT$mix-1080.mp4
done
ls -la $R/$CUT*
