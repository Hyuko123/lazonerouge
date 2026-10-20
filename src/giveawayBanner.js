const { createCanvas } = require('@napi-rs/canvas');

function wrapText(context, text, maxWidth, maxLines) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const usedWords = lines.join(' ').split(' ').length;
  if (usedWords < words.length && lines.length) {
    let lastLine = lines[lines.length - 1];
    while (lastLine && context.measureText(`${lastLine}…`).width > maxWidth) lastLine = lastLine.slice(0, -1);
    lines[lines.length - 1] = `${lastLine.trimEnd()}…`;
  }
  return lines;
}

function makeGiveawayBanner({ prize, winners, duration, endsAt }) {
  const canvas = createCanvas(1280, 520);
  const context = canvas.getContext('2d');
  context.fillStyle = '#0B1117';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = 'rgba(137, 255, 85, 0.08)';
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.fillStyle = '#B7F34A';
  context.beginPath();
  context.moveTo(925, 0);
  context.lineTo(1280, 0);
  context.lineTo(1280, 520);
  context.lineTo(1055, 520);
  context.lineTo(820, 190);
  context.closePath();
  context.fill();
  context.fillStyle = '#101820';
  context.beginPath();
  context.moveTo(1005, 0);
  context.lineTo(1280, 0);
  context.lineTo(1280, 520);
  context.lineTo(1145, 520);
  context.lineTo(920, 205);
  context.closePath();
  context.fill();

  const centerX = 1100;
  const centerY = 255;
  context.strokeStyle = 'rgba(183, 243, 74, 0.65)';
  context.lineWidth = 3;
  for (const radius of [48, 88, 128]) {
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(centerX - 170, centerY);
  context.lineTo(centerX + 170, centerY);
  context.moveTo(centerX, centerY - 170);
  context.lineTo(centerX, centerY + 170);
  context.stroke();
  context.fillStyle = '#B7F34A';
  context.beginPath();
  context.arc(centerX, centerY, 8, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#B7F34A';
  context.fillRect(72, 72, 8, 62);
  context.font = 'bold 20px Arial';
  context.fillText('VALORANT  /  ÉVÉNEMENT COMMUNAUTAIRE', 98, 105);
  context.fillStyle = '#F4F7F2';
  context.font = 'bold 72px Arial';
  context.fillText('CONCOURS', 72, 225);

  context.fillStyle = '#AAB7C2';
  context.font = 'bold 18px Arial';
  context.fillText('À GAGNER', 78, 277);
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 42px Arial';
  const prizeLines = wrapText(context, prize, 690, 2);
  prizeLines.forEach((line, index) => context.fillText(line, 76, 329 + index * 50, 700));

  context.fillStyle = '#B7F34A';
  context.fillRect(72, 435, 700, 2);
  context.fillStyle = '#F4F7F2';
  context.font = 'bold 18px Arial';
  context.fillText(`${winners} GAGNANT${winners === 1 ? '' : 'S'}`, 78, 478);
  context.fillStyle = '#AAB7C2';
  context.font = '18px Arial';
  context.fillText(`DURÉE  ${duration.toUpperCase()}`, 280, 478);
  context.fillText(`FIN  ${new Date(endsAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`, 520, 478, 300);

  return canvas.toBuffer('image/png');
}

module.exports = { makeGiveawayBanner };