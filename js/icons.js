/* ============================================================================
 *  icons.js — inline SVG icon set (replaces all emoji in the UI).
 *  ICON('name', size, color) → SVG string. Uses currentColor by default.
 * ========================================================================== */

const ICON = (() => {
  // 24x24 path data.
  const P = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 0 1 0 8"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 9h18"/><circle cx="17" cy="13" r="1.4" fill="currentColor" stroke="none"/>',
    link: '<path d="M9 15l6-6"/><path d="M10.5 6.5l1.7-1.7a4 4 0 0 1 5.7 5.7l-1.7 1.7"/><path d="M13.5 17.5l-1.7 1.7a4 4 0 0 1-5.7-5.7l1.7-1.7"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1a3 3 0 0 0 3 3"/><path d="M17 6h3v1a3 3 0 0 1-3 3"/><path d="M9 20h6"/><path d="M12 14v6"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z" fill="currentColor" stroke="none"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4" stroke-width="1.6"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16"/><path d="M12 9v11"/><path d="M12 9C9 9 7.5 5 9.5 4.2S12 7 12 9zM12 9c3 0 4.5-4 2.5-4.8S12 7 12 9z"/>',
    send: '<path d="M21 3 3 11l7 2 2 7 9-17z"/><path d="M10 13l4-4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chain: '<path d="M10 13a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1"/><path d="M14 11a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" stroke="none"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    play: '<path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none"/>',
    refresh: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/>',
    star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z" fill="currentColor" stroke="none"/>',
    medal: '<circle cx="12" cy="15" r="5"/><path d="M9 4l3 7 3-7"/><path d="M12 13.5v3M10.6 15h2.8" stroke-width="1.4"/>',
    glove: '<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3M10 10V6a1.5 1.5 0 0 1 3 0v4M13 10V7a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6H9a4 4 0 0 1-4-4v-1l2-2"/>',
  };

  return function (name, size = 18, color = 'currentColor', stroke = 2) {
    const d = P[name] || '';
    return `<svg class="ic ic-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"
      style="vertical-align:middle;flex:none">${d}</svg>`;
  };
})();
