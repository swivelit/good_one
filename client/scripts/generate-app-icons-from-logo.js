const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const resourcesDir = path.join(projectRoot, "resources");
const logoPath = path.join(publicDir, "logo.png");
const iconPath = path.join(resourcesDir, "icon.png");
const splashPath = path.join(resourcesDir, "splash.png");
const manifestPath = path.join(publicDir, "manifest.json");

const WHITE = "#ffffff";
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;

async function renderCenteredLogo({ outputPath, canvasSize, maxLogoWidthRatio }) {
  const logoBuffer = await sharp(logoPath)
    .trim({ threshold: 8 })
    .resize({
      width: Math.round(canvasSize * maxLogoWidthRatio),
      height: Math.round(canvasSize * 0.7),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toFile(outputPath);
}

async function keepSourceLogoOutOfPwaCleanup() {
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    const nextIcons = icons.filter((icon) => path.basename(icon.src || "") !== "logo.png");

    if (nextIcons.length !== icons.length) {
      await fs.writeFile(
        manifestPath,
        `${JSON.stringify({ ...manifest, icons: nextIcons }, null, 2)}\n`
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function main() {
  await fs.access(logoPath);
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.mkdir(path.join(publicDir, "assets"), { recursive: true });

  await renderCenteredLogo({
    outputPath: iconPath,
    canvasSize: ICON_SIZE,
    maxLogoWidthRatio: 0.86,
  });

  await renderCenteredLogo({
    outputPath: splashPath,
    canvasSize: SPLASH_SIZE,
    maxLogoWidthRatio: 0.52,
  });

  await keepSourceLogoOutOfPwaCleanup();

  console.log(`Generated ${path.relative(projectRoot, iconPath)} from public/logo.png`);
  console.log(`Generated ${path.relative(projectRoot, splashPath)} from public/logo.png`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
