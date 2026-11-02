import { access, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const IMAGES = path.resolve("docs", "images");
const OUTPUT = path.join(IMAGES, "memory-lane-demo.gif");
const SLIDES = [
  "library.png",
  "viewer.png",
  "scan.png",
  "backup-destination.png",
  "backup-plan.png",
  "backup-run.png",
  "backup-overview.png",
  "library-health.png",
  "settings.png",
];
const CLIP_SECONDS = 3;
const TRANSITION_SECONDS = 0.5;
const WIDTH = 960;
const FPS = 10;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with ${String(code)}\n${stderr.slice(-2000)}`));
    });
  });
}

for (const slide of SLIDES) {
  await access(path.join(IMAGES, slide));
}

const args = ["-y"];
for (const slide of SLIDES) {
  args.push("-loop", "1", "-t", String(CLIP_SECONDS), "-i", path.join(IMAGES, slide));
}

const filters = SLIDES.map(
  (_, index) =>
    `[${String(index)}:v]scale=${String(WIDTH)}:-1:flags=lanczos,setsar=1,fps=${String(FPS)}[v${String(index)}]`,
);
let last = "v0";
for (let index = 1; index < SLIDES.length; index += 1) {
  const output = index === SLIDES.length - 1 ? "joined" : `joined${String(index)}`;
  const offset = index * (CLIP_SECONDS - TRANSITION_SECONDS);
  filters.push(
    `[${last}][v${String(index)}]xfade=transition=fade:duration=${String(TRANSITION_SECONDS)}:offset=${offset.toFixed(2)}[${output}]`,
  );
  last = output;
}
filters.push(
  `[${last}]split[paletteSource][paletteTarget];[paletteSource]palettegen=max_colors=96:stats_mode=diff[p];[paletteTarget][p]paletteuse=dither=bayer:bayer_scale=3[out]`,
);
args.push("-filter_complex", filters.join(";"), "-map", "[out]", "-loop", "0", OUTPUT);

await runFfmpeg(args);
const info = await stat(OUTPUT);
console.log(
  `Wrote ${path.relative(process.cwd(), OUTPUT)} (${(info.size / 1024 / 1024).toFixed(2)} MB)`,
);
