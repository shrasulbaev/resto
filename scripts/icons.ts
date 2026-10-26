// Generates the PWA icons from one SVG: `npx tsx scripts/icons.ts`.
import sharp from "sharp";

const svg = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0F1012"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <rect x="56" y="56" width="400" height="400" rx="110" fill="#F0B44C"/>
    <path d="M176 336v-80a80 80 0 0 1 160 0v80l20 28H156z" fill="#1A1405"/>
    <path d="M232 392h48" stroke="#1A1405" stroke-width="28" stroke-linecap="round"/>
  </g>
</svg>`;

async function main() {
  for (const [file, size, pad] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["icon-maskable-512.png", 512, 60], ["apple-touch-icon.png", 180, 0]] as const) {
    await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/${file}`);
  }
  await sharp(Buffer.from(svg(0))).resize(96, 96).png().toFile("public/badge-96.png");
}

main();
