import sharp from "sharp";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function colorDistance(r, g, b, bg) {
  return Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
}

function backgroundFromCorners(data, width, height, channels) {
  const samples = [];
  const size = Math.max(8, Math.floor(Math.min(width, height) * 0.06));
  for (const [x0, y0] of [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]]) {
    for (let y = y0; y < y0 + size; y += 3) {
      for (let x = x0; x < x0 + size; x += 3) {
        const i = (y * width + x) * channels;
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const middle = samples.slice(Math.floor(samples.length * 0.25), Math.ceil(samples.length * 0.75));
  return {
    r: middle.reduce((sum, value) => sum + value[0], 0) / middle.length,
    g: middle.reduce((sum, value) => sum + value[1], 0) / middle.length,
    b: middle.reduce((sum, value) => sum + value[2], 0) / middle.length,
  };
}

function components(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  const found = [];
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    const pixels = [];
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const index = stack.pop();
      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const next of [index - 1, index + 1, index - width, index + width]) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    found.push({ pixels, minX, minY, maxX, maxY });
  }
  return found.sort((a, b) => b.pixels.length - a.pixels.length);
}

async function cleanAsset(input, output, kind) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const bg = backgroundFromCorners(data, width, height, channels);
  const distances = new Float32Array(width * height);
  const binary = new Uint8Array(width * height);

  for (let pixel = 0; pixel < width * height; pixel++) {
    const i = pixel * channels;
    const distance = colorDistance(data[i], data[i + 1], data[i + 2], bg);
    distances[pixel] = distance;
    binary[pixel] = distance > (kind === "animal" ? 20 : 24) ? 1 : 0;
  }

  const allComponents = components(binary, width, height);
  const keep = new Uint8Array(width * height);
  if (kind === "animal") {
    const main = allComponents[0];
    for (const pixel of main?.pixels ?? []) keep[pixel] = 1;
  } else {
    const minimum = width * height * 0.00025;
    for (const component of allComponents) {
      const centerX = (component.minX + component.maxX) / 2;
      const centerY = (component.minY + component.maxY) / 2;
      const central = centerX > width * 0.16 && centerX < width * 0.84 && centerY > height * 0.12 && centerY < height * 0.88;
      if (component.pixels.length >= minimum && central) {
        for (const pixel of component.pixels) keep[pixel] = 1;
      }
    }
  }

  // Expand the kept mask so soft watercolor edges remain attached to the main subject.
  const expanded = keep.slice();
  for (let pass = 0; pass < 5; pass++) {
    const next = expanded.slice();
    for (let index = 0; index < expanded.length; index++) {
      if (!expanded[index]) continue;
      const x = index % width;
      for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
        if (neighbor < 0 || neighbor >= expanded.length || Math.abs((neighbor % width) - x) > 1) continue;
        if (distances[neighbor] > 6) next[neighbor] = 1;
      }
    }
    expanded.set(next);
  }

  const filledInterior = new Uint8Array(width * height);
  if (kind === "animal") {
    const inverse = expanded.map((value) => value ? 0 : 1);
    for (const component of components(inverse, width, height)) {
      const touchesEdge = component.minX === 0 || component.minY === 0 || component.maxX === width - 1 || component.maxY === height - 1;
      if (!touchesEdge && component.pixels.length < width * height * 0.12) {
        for (const pixel of component.pixels) {
          expanded[pixel] = 1;
          filledInterior[pixel] = 1;
        }
      }
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    const source = pixel * channels;
    const target = pixel * 4;
    rgba[target] = data[source];
    rgba[target + 1] = data[source + 1];
    rgba[target + 2] = data[source + 2];
    const alpha = filledInterior[pixel] ? 255 : expanded[pixel] ? Math.max(0, Math.min(255, (distances[pixel] - 5) * 12)) : 0;
    rgba[target + 3] = alpha;
    if (alpha > 12) {
      const x = pixel % width, y = Math.floor(pixel / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }

  const margin = kind === "animal" ? 8 : 5;
  const left = Math.max(0, minX - margin), top = Math.max(0, minY - margin);
  const cropWidth = Math.min(width - left, maxX - minX + 1 + margin * 2);
  const cropHeight = Math.min(height - top, maxY - minY + 1 + margin * 2);
  const size = kind === "animal" ? 640 : 160;
  const padding = kind === "animal" ? 42 : 22;
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(size - padding * 2, size - padding * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(output);
}

for (const [sourceDir, destinationDir, kind] of [
  ["public/animals", "public/animals-clean", "animal"],
  ["public/icons", "public/icons-clean", "icon"],
]) {
  const source = path.join(root, sourceDir);
  const destination = path.join(root, destinationDir);
  await mkdir(destination, { recursive: true });
  for (const file of (await readdir(source)).filter((name) => name.endsWith(".png"))) {
    await cleanAsset(path.join(source, file), path.join(destination, file), kind);
  }
}
