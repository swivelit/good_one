const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const resourcesDir = path.join(projectRoot, "resources");
const logoPath = path.join(publicDir, "logo.png");
const iconPath = path.join(resourcesDir, "icon.png");
const splashPath = path.join(resourcesDir, "splash.png");
const logo192Path = path.join(publicDir, "logo192.png");
const logo512Path = path.join(publicDir, "logo512.png");
const faviconPath = path.join(publicDir, "favicon.ico");
const publicIconDir = path.join(publicDir, "assets", "icons");
const productPlaceholderPath = path.join(publicIconDir, "product-placeholder.png");
const manifestPath = path.join(publicDir, "manifest.json");

const WHITE = "#ffffff";
const SOFT_ORANGE = "#fff8f4";
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;
const WEB_ICON_SIZES = [48, 72, 96, 128, 192, 256, 512];

async function getTrimmedLogoBuffer() {
  return sharp(logoPath)
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

async function getLauncherSourceBuffer(trimmedLogoBuffer) {
  const metadata = await sharp(trimmedLogoBuffer).metadata();
  const isWide = metadata.width / metadata.height > 2.5;

  if (!isWide) return trimmedLogoBuffer;

  const markWidth = Math.min(metadata.width, Math.round(metadata.height * 1.16));
  return sharp(trimmedLogoBuffer)
    .extract({ left: 0, top: 0, width: markWidth, height: metadata.height })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

async function renderSquareIconBuffer({ sourceBuffer, size, maxRatio = 0.78, background = WHITE }) {
  const resized = await sharp(sourceBuffer)
    .resize({
      width: Math.round(size * maxRatio),
      height: Math.round(size * maxRatio),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

async function writeSquareIcon({ sourceBuffer, outputPath, size, maxRatio, background }) {
  const buffer = await renderSquareIconBuffer({ sourceBuffer, size, maxRatio, background });
  await fs.writeFile(outputPath, buffer);
}

async function renderCenteredLogo({ sourceBuffer, outputPath, width, height, maxLogoWidthRatio, background }) {
  const logoBuffer = await sharp(sourceBuffer)
    .resize({
      width: Math.round(width * maxLogoWidthRatio),
      height: Math.round(height * 0.7),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toFile(outputPath);
}

async function writeIcoFile(sourceBuffer) {
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((size) => renderSquareIconBuffer({ sourceBuffer, size, maxRatio: 0.78 }))
  );
  const headerSize = 6 + sizes.length * 16;
  let offset = headerSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  pngBuffers.forEach((buffer, index) => {
    const entryOffset = 6 + index * 16;
    const size = sizes[index];
    header.writeUInt8(size, entryOffset);
    header.writeUInt8(size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += buffer.length;
  });

  await fs.writeFile(faviconPath, Buffer.concat([header, ...pngBuffers]));
}

async function writePublicIcons(launcherSourceBuffer, fullLogoBuffer) {
  await fs.mkdir(publicIconDir, { recursive: true });

  await Promise.all(
    WEB_ICON_SIZES.map((size) =>
      writeSquareIcon({
        sourceBuffer: launcherSourceBuffer,
        outputPath: path.join(publicIconDir, `icon-${size}.png`),
        size,
        maxRatio: 0.78,
        background: WHITE,
      })
    )
  );

  await writeSquareIcon({
    sourceBuffer: launcherSourceBuffer,
    outputPath: logo192Path,
    size: 192,
    maxRatio: 0.78,
    background: WHITE,
  });
  await writeSquareIcon({
    sourceBuffer: launcherSourceBuffer,
    outputPath: logo512Path,
    size: 512,
    maxRatio: 0.78,
    background: WHITE,
  });
  await writeIcoFile(launcherSourceBuffer);

  await renderCenteredLogo({
    sourceBuffer: fullLogoBuffer,
    outputPath: productPlaceholderPath,
    width: 1200,
    height: 900,
    maxLogoWidthRatio: 0.62,
    background: SOFT_ORANGE,
  });
}

async function renamePngBackedWebpIcons() {
  try {
    const files = await fs.readdir(publicIconDir);

    await Promise.all(
      files
        .filter((fileName) => /^icon-\d+\.webp$/i.test(fileName))
        .map(async (fileName) => {
          const from = path.join(publicIconDir, fileName);
          const to = path.join(publicIconDir, fileName.replace(/\.webp$/i, ".png"));
          await fs.rm(to, { force: true });
          await fs.rename(from, to);
        })
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function writeManifest() {
  const icons = WEB_ICON_SIZES.map((size) => ({
    src: `assets/icons/icon-${size}.png`,
    type: "image/png",
    sizes: `${size}x${size}`,
    purpose: "any maskable",
  }));

  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    await fs.writeFile(manifestPath, `${JSON.stringify({ ...manifest, icons }, null, 2)}\n`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function main() {
  await fs.access(logoPath);
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.mkdir(publicIconDir, { recursive: true });

  const fullLogoBuffer = await getTrimmedLogoBuffer();
  const launcherSourceBuffer = await getLauncherSourceBuffer(fullLogoBuffer);

  await writeSquareIcon({
    sourceBuffer: launcherSourceBuffer,
    outputPath: iconPath,
    size: ICON_SIZE,
    maxRatio: 0.78,
    background: WHITE,
  });

  await renderCenteredLogo({
    sourceBuffer: fullLogoBuffer,
    outputPath: splashPath,
    width: SPLASH_SIZE,
    height: SPLASH_SIZE,
    maxLogoWidthRatio: 0.52,
    background: WHITE,
  });

  await writePublicIcons(launcherSourceBuffer, fullLogoBuffer);
  await renamePngBackedWebpIcons();
  await writeManifest();

  console.log(`Generated ${path.relative(projectRoot, iconPath)} from public/logo.png`);
  console.log(`Generated ${path.relative(projectRoot, splashPath)} from public/logo.png`);
  console.log("Generated public web icons, favicon, and product placeholder");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
