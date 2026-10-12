// Inline SVG icons (24x24 viewBox). Chunky outlines to match the cartoon style.
const O = 'stroke="#1b2350" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

export const ICONS = {
  heart: `<svg viewBox="0 0 24 24"><path ${O} fill="#ff5c7a" d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z"/><ellipse cx="8.3" cy="8.6" rx="1.8" ry="1.2" fill="#fff" opacity=".8"/></svg>`,
  flag: `<svg viewBox="0 0 24 24"><path ${O} fill="none" d="M5 21V3"/><path ${O} fill="#5fe3ff" d="M5 4h12l-2.5 4L17 12H5z"/></svg>`,
  slime: `<svg viewBox="0 0 24 24"><path ${O} fill="#7ee05a" d="M4 19c-1-4 1-11 8-11s9 7 8 11z"/><circle cx="9.5" cy="13.5" r="1.4" fill="#1b2350"/><circle cx="14.5" cy="13.5" r="1.4" fill="#1b2350"/><ellipse cx="8" cy="10.5" rx="1.6" ry="1" fill="#fff" opacity=".8"/></svg>`,
  coin: `<svg viewBox="0 0 24 24"><circle ${O} cx="12" cy="12" r="9" fill="#ffd23f"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#e8960c" stroke-width="2"/><path d="M8.5 8a5 5 0 0 1 3-1.6" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
  gear: `<svg viewBox="0 0 24 24"><path ${O} fill="#c9d3ff" d="M10.3 2.8h3.4l.5 2.4 1.7.9 2.2-1.1 2.4 2.4-1.1 2.2.9 1.7 2.4.5v3.4l-2.4.5-.9 1.7 1.1 2.2-2.4 2.4-2.2-1.1-1.7.9-.5 2.4h-3.4l-.5-2.4-1.7-.9-2.2 1.1-2.4-2.4 1.1-2.2-.9-1.7-2.4-.5v-3.4l2.4-.5.9-1.7-1.1-2.2 2.4-2.4 2.2 1.1 1.7-.9z"/><circle ${O} cx="12" cy="12" r="3" fill="#26306a"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><rect ${O} x="5.5" y="4" width="4.5" height="16" rx="1.6" fill="#fff"/><rect ${O} x="14" y="4" width="4.5" height="16" rx="1.6" fill="#fff"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>`,
  sound: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M3 9.5h4l5-4.5v14l-5-4.5H3z"/><path ${O} fill="none" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
  mute: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M3 9.5h4l5-4.5v14l-5-4.5H3z"/><path ${O} fill="none" d="M16 9l5 6M21 9l-5 6"/></svg>`,
  crown: `<svg viewBox="0 0 24 24"><path ${O} fill="#ffd23f" d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><circle cx="12" cy="15" r="1.6" fill="#ff4f8b"/></svg>`,
  restart: `<svg viewBox="0 0 24 24"><path ${O} fill="none" stroke-width="2.6" d="M19 12a7 7 0 1 1-2.1-5"/><path ${O} fill="#fff" d="M19.5 3.5v5h-5z"/></svg>`,
  home: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`,
  shake: `<svg viewBox="0 0 24 24"><rect ${O} x="7" y="4" width="10" height="16" rx="2.5" fill="#c9d3ff"/><path ${O} fill="none" d="M3 9v6M21 9v6"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24"><path ${O} fill="#ffd23f" d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z"/><circle cx="19" cy="19" r="1.8" fill="#5fe3ff"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff6c2" d="M7 3h10v5a5 5 0 0 1-10 0z"/><path ${O} fill="none" d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4M12 13v4M8 21h8l-1-4H9z"/></svg>`,
  broken: `<svg viewBox="0 0 24 24"><path ${O} fill="#c8fbff" d="M12 2 19 10 12 22 5 10z"/><path ${O} fill="none" d="M12 4l-2 5 3 2-2 4 1 4"/></svg>`,

  // ---- upgrades
  rapid: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M4 6l7 6-7 6z"/><path ${O} fill="#fff" d="M12 6l7 6-7 6z"/></svg>`,
  power: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M12 2.5 18 10l-6 11.5L6 10z"/><path ${O} fill="none" d="M12 2.5V21.5M6 10h12"/><path ${O} fill="#ffd23f" d="M18.5 2.5v5M16 5h5"/></svg>`,
  split: `<svg viewBox="0 0 24 24"><circle ${O} cx="4.5" cy="12" r="2.5" fill="#fff"/><path ${O} fill="none" d="M7 12h6M7 11l6-6M7 13l6 6"/><circle ${O} cx="17" cy="5" r="2.6" fill="#fff"/><circle ${O} cx="18" cy="12" r="2.6" fill="#fff"/><circle ${O} cx="17" cy="19" r="2.6" fill="#fff"/></svg>`,
  chain: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z"/></svg>`,
  frost: `<svg viewBox="0 0 24 24"><g ${O} fill="none" stroke-width="2.4"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/></g><circle cx="12" cy="12" r="2.3" fill="#fff" ${O}/></svg>`,
  splash: `<svg viewBox="0 0 24 24"><circle ${O} cx="12" cy="12" r="4" fill="#fff"/><path ${O} fill="none" stroke-width="2.4" d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>`,
  heal: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z"/><path stroke="#23b46b" stroke-width="2.6" stroke-linecap="round" d="M12 9v6M9 12h6"/></svg>`,
  crit: `<svg viewBox="0 0 24 24"><path ${O} fill="#fff" d="M12 2.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16l-5.4 3.1 1.2-6.1-4.5-4.2 6.1-.7z"/><path d="M12 8.5v3.5" stroke="#ff5c7a" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="14.2" r="1.2" fill="#ff5c7a"/></svg>`,
  reach: `<svg viewBox="0 0 24 24"><circle ${O} cx="12" cy="12" r="9.5" fill="none"/><circle ${O} cx="12" cy="12" r="5.5" fill="#fff"/><circle cx="12" cy="12" r="2" fill="#1b2350"/><path ${O} fill="none" d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>`,
};

/** Replace every [data-icon] placeholder inside `root` with its SVG. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}
