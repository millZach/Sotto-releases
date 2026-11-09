# Staging the site's pictures

The pictures and recordings in `site/media/` are Sotto itself, showing one made-up evening: three threads (`Retry failed uploads` on Codex, `Fix the flaky host test` on Claude Code, `Tidy the Settings copy` on Grok Build) in a project called `my-app`, from 5:38 pm to 6:49 pm. Nothing in them is anyone's real work.

They were staged on November 9, 2026 from millZach/Sotto at `22fcaa7`, on Linux under Xvfb. `watcher-evening.patch` is everything that run added to a fresh clone: the story's threads in the end-to-end fixture (`src/shared/e2e.ts`), the capture spec (`tests/e2e/site-capture.spec.ts`) and two shell scripts.

## Stage them again

Sotto's test harness changes, so expect to adjust the patch to the app as it is by then.

```sh
git clone --depth 1 https://github.com/millZach/Sotto.git ~/sotto-site-capture
cd ~/sotto-site-capture
git apply -p1 /path/to/site-src/capture/watcher-evening.patch
npm ci
# Node 26's npm skipped these install scripts; run them by hand if Electron or esbuild is missing.
(cd node_modules/electron && node install.js)
(cd node_modules/esbuild && node install.js)
(cd node_modules/electron-vite/node_modules/esbuild && node install.js)

bash run-site-capture.sh stills build                 # stills, 1280x800 and 820x560 windows at scale 2
SITE_SCALE=100 bash run-site-capture.sh record        # recordings, 1280x800
SITE_SCALE=200 bash run-site-capture.sh record        # recordings, 2560x1600
SITE_SCALE=200 SITE_SIZE=820 bash run-site-capture.sh record   # recordings for phones, 1640x1120
bash check-site-capture.sh                            # ffprobe each recording, pull frames to read
```

The files land in `~/sotto-site-capture-out/`. Open every still and a few frames of every recording and read the text before using them.

## What the page uses

| On the page | Still (WebP) | Recording (MP4, no sound) |
|---|---|---|
| The window under the headline, and 5:38 pm | `room.webp` 2560 wide, `room-1280.webp`, `room-m.webp` for phones | `room.mp4`, `room-2x.mp4` |
| 5:59 pm | `follow.webp`, `follow-1280.webp`, `follow-m.webp` | `follow.mp4`, `follow-2x.mp4`, `follow-m.mp4` |
| 6:02 pm | `needs.webp`, `needs-1280.webp`, `needs-m.webp` | `needs.mp4`, `needs-2x.mp4`, `needs-m.mp4` |
| 6:40 pm | `merge.webp`, `merge-1280.webp`, `merge-m.webp` | `merge.mp4`, `merge-2x.mp4`, `merge-m.mp4` |
| Every thread, in one window | `changes.webp` 3200 wide, `changes-1600.webp` | none |
| And in your pocket | `phone.webp` | none |

The capture names them `room`, `watched`, `needs-you` and `merge`. A still is the PNG as WebP, at its own size and at half:

```sh
ffmpeg -i room-1280.png -c:v libwebp -quality 80 -compression_level 6 room.webp
ffmpeg -i room-1280.png -vf scale=1280:-2:flags=lanczos -c:v libwebp -quality 82 -compression_level 6 room-1280.webp
ffmpeg -i room-820.png -c:v libwebp -quality 80 -compression_level 6 room-m.webp
```

A recording is copied as it is: `watched.mp4` to `follow.mp4`, `watched@2x.mp4` to `follow-2x.mp4`, `watched-820.mp4` to `follow-m.mp4`, and so on.

`phone.webp` is `artifacts/iphone-threads-list/max-threads.jpg` from millZach/Sotto: the iPhone app on an iPhone 17 Pro Max simulator with its own fixture, captured on October 30, 2026.

Each picture on the page is cropped to the part its words are about, by `--z`, `--fx` and `--fy` (and `--zm`, `--fxm`, `--fym` for phones) on its `.shot` in `site-src/index.html`. A recording takes the same crop as its still, so stage both from the same window size. After changing a picture, change its `alt` text and every language's translation of it to match.
