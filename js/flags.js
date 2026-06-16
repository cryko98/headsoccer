/* ============================================================================
 *  flags.js — procedural national flags as inline SVG (no emoji, no images).
 *  Flags.svg(team, w, h) → SVG markup string. Recognizable, lightweight.
 * ========================================================================== */

const Flags = (() => {
  function rect(x, y, w, h, c) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`; }

  function star(cx, cy, r, c, points = 5, rot = -Math.PI / 2) {
    let p = '';
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? r : r * 0.42;
      const a = rot + (i * Math.PI) / points;
      p += `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad} `;
    }
    return `<polygon points="${p.trim()}" fill="${c}"/>`;
  }

  // Returns inner markup for a 60x40 viewBox.
  function body(team) {
    const f = team.flag, W = 60, H = 40;
    switch (f.type) {
      case 'v3': {
        const w = W / 3;
        return rect(0, 0, w, H, f.c[0]) + rect(w, 0, w, H, f.c[1]) + rect(2 * w, 0, w, H, f.c[2]);
      }
      case 'v2': { // Portugal-ish 2/5 + 3/5
        const w = W * 0.4;
        return rect(0, 0, w, H, f.c[0]) + rect(w, 0, W - w, H, f.c[1]) +
          `<circle cx="${w}" cy="${H / 2}" r="7" fill="${f.em}" stroke="#fff" stroke-width="1.2"/>`;
      }
      case 'h3': {
        const r = f.ratio || [1, 1, 1];
        const tot = r[0] + r[1] + r[2];
        const h0 = (H * r[0]) / tot, h1 = (H * r[1]) / tot, h2 = (H * r[2]) / tot;
        return rect(0, 0, W, h0, f.c[0]) + rect(0, h0, W, h1, f.c[1]) + rect(0, h0 + h1, W, h2, f.c[2]);
      }
      case 'h3s': { // Argentina horizontal + sun
        const h = H / 3;
        return rect(0, 0, W, h, f.c[0]) + rect(0, h, W, h, f.c[1]) + rect(0, 2 * h, W, h, f.c[2]) +
          `<circle cx="${W / 2}" cy="${H / 2}" r="5.5" fill="${f.em}"/>` + star(W / 2, H / 2, 8, f.em, 12, 0);
      }
      case 'disc': // Japan
        return rect(0, 0, W, H, f.c[0]) + `<circle cx="${W / 2}" cy="${H / 2}" r="11" fill="${f.c[1]}"/>`;
      case 'cross': // England
        return rect(0, 0, W, H, f.c[0]) +
          rect(0, H / 2 - 4, W, 8, f.c[1]) + rect(W / 2 - 4, 0, 8, H, f.c[1]);
      case 'star': // Morocco
        return rect(0, 0, W, H, f.c[0]) + star(W / 2, H / 2, 10, 'none', 5) +
          `<polygon points="${starPts(W / 2, H / 2, 11, 5)}" fill="none" stroke="${f.c[1]}" stroke-width="2"/>`;
      case 'usa': {
        let s = '';
        for (let i = 0; i < 7; i++) s += rect(0, i * (H / 7), W, H / 7, i % 2 ? '#ffffff' : '#bf0a30');
        s += rect(0, 0, W * 0.42, H * 0.54, '#1c3f94');
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)
          s += star(4 + c * 6.5, 4 + r * 6.5, 2.4, '#fff');
        return s;
      }
      case 'canada':
        return rect(0, 0, W * 0.28, H, '#d52b1e') + rect(W * 0.72, 0, W * 0.28, H, '#d52b1e') +
          rect(W * 0.28, 0, W * 0.44, H, '#fff') +
          `<polygon points="${maple(W / 2, H / 2, 9)}" fill="#d52b1e"/>`;
      case 'brazil':
        return rect(0, 0, W, H, '#009b3a') +
          `<polygon points="${W / 2},5 ${W - 7},${H / 2} ${W / 2},${H - 5} 7,${H / 2}" fill="#ffdf00"/>` +
          `<circle cx="${W / 2}" cy="${H / 2}" r="8" fill="#002776"/>`;
      case 'korea':
        return rect(0, 0, W, H, '#ffffff') +
          `<circle cx="${W / 2}" cy="${H / 2}" r="9" fill="#c8102e"/>` +
          `<path d="M ${W / 2 - 9} ${H / 2} A 4.5 4.5 0 0 1 ${W / 2} ${H / 2} A 4.5 4.5 0 0 0 ${W / 2 + 9} ${H / 2}" fill="#003478"/>`;
      default:
        return rect(0, 0, W, H, team.primary);
    }
  }

  function starPts(cx, cy, r, points) {
    let p = '';
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? r : r * 0.42;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      p += `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)} `;
    }
    return p.trim();
  }

  function maple(cx, cy, r) {
    // Simplified maple-leaf-ish star.
    return starPts(cx, cy, r, 5);
  }

  return {
    svg(team, w = 26, h = 18, cls = '') {
      return `<svg class="flag-svg ${cls}" viewBox="0 0 60 40" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" style="border-radius:3px">${body(team)}</svg>`;
    },
  };
})();
