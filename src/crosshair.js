const { createCanvas } = require('@napi-rs/canvas');

const COLORS = ['#FF4655', '#00FF00', '#AAFF00', '#FFFF00', '#FFD700', '#00FFFF', '#FF00FF', '#FFFFFF'];

function parseCrosshairCode(code) {
  const parts = code.trim().split(';').map(part => part.trim());
  if (parts.length < 4 || parts[0] !== '0' || parts[1] !== 'P') return null;

  const settings = {};
  let section = 'P';
  for (let index = 2; index < parts.length; index++) {
    const key = parts[index];
    if (['P', 'S', 'A'].includes(key)) {
      section = key;
      continue;
    }
    const value = parts[index + 1];
    if (value === undefined) return null;
    if (section === 'P') settings[key] = value;
    index++;
  }
  return settings;
}

function numeric(settings, key, fallback, minimum, maximum) {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function colorFrom(settings) {
  if (settings.c === '8' && /^[\da-f]{6}$/i.test(settings.u || '')) return `#${settings.u}`;
  const colorIndex = Number(settings.c);
  return COLORS[Number.isInteger(colorIndex) ? colorIndex : 0] || COLORS[0];
}

function drawLines(context, center, length, thickness, offset, color, opacity, outlineOpacity, outlineWidth) {
  if (length <= 0 || thickness <= 0 || opacity <= 0) return;
  const { x, y } = center;
  const segments = [
    [x, y - offset, x, y - offset - length],
    [x, y + offset, x, y + offset + length],
    [x - offset, y, x - offset - length, y],
    [x + offset, y, x + offset + length, y]
  ];
  const draw = (width, stroke) => {
    context.beginPath();
    for (const segment of segments) {
      context.moveTo(segment[0], segment[1]);
      context.lineTo(segment[2], segment[3]);
    }
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.lineCap = 'square';
    context.stroke();
  };

  if (outlineWidth > 0) {
    context.globalAlpha = outlineOpacity;
    draw(thickness + outlineWidth * 2, '#000000');
  }
  context.globalAlpha = opacity;
  draw(thickness, color);
}

function renderCrosshair(code) {
  const settings = parseCrosshairCode(code);
  if (!settings) return null;

  const size = 512;
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.fillStyle = '#15171C';
  context.fillRect(0, 0, size, size);
  const center = { x: size / 2, y: size / 2 };
  const color = colorFrom(settings);
  const outlineAlpha = numeric(settings, 'o', 0, 0, 1);
  const outlineWidth = outlineAlpha > 0 ? Math.max(1, numeric(settings, 's', 1, 0, 6)) : 0;

  if (settings['0b'] !== '0') {
    drawLines(
      context, center,
      numeric(settings, '0l', 5, 0, 50) * 8,
      numeric(settings, '0t', 1, 0, 20) * 4,
      numeric(settings, '0o', 2, 0, 30) * 8,
      color, numeric(settings, '0a', 1, 0, 1), outlineAlpha, outlineWidth * 2
    );
  }

  if (settings['1b'] === '1') {
    drawLines(
      context, center,
      numeric(settings, '1l', 2, 0, 50) * 8,
      numeric(settings, '1t', 1, 0, 20) * 4,
      (numeric(settings, '0o', 2, 0, 30) + numeric(settings, '1o', 2, 0, 30)) * 8,
      color, numeric(settings, '1a', 1, 0, 1), outlineAlpha, outlineWidth * 2
    );
  }

  if (settings.d === '1') {
    const dotSize = Math.max(2, numeric(settings, 'z', 1, 0, 20) * 3);
    context.globalAlpha = numeric(settings, 'a', 1, 0, 1);
    context.fillStyle = color;
    context.fillRect(center.x - dotSize / 2, center.y - dotSize / 2, dotSize, dotSize);
    if (outlineWidth > 0) {
      context.globalAlpha = outlineAlpha;
      context.strokeStyle = '#000000';
      context.lineWidth = outlineWidth;
      context.strokeRect(center.x - dotSize / 2, center.y - dotSize / 2, dotSize, dotSize);
    }
  }

  context.globalAlpha = 1;
  return canvas.toBuffer('image/png');
}

module.exports = { parseCrosshairCode, renderCrosshair };