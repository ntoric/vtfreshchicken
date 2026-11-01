import styles from "./malayalam-fonts.module.css";

// Malayalam typefaces for the Malayalam landing page. The Latin display fonts
// used by the other designs (Oswald, Dancing Script, Fraunces) have no
// Malayalam glyphs, so this variant uses its own set:
//   body    — Noto Sans Malayalam (clean, highly legible UI text)
//   display — Baloo Chettan 2 (heavy, rounded headline face)
//   script  — Chilanka (hand-lettered accent, like the hero script line)
//
// Self-hosted (./fonts, declared in malayalam-fonts.module.css) rather than
// next/font/google: Google intermittently serves these families with
// extension-less file URLs, which crashes the Next 14 font loader at build time.
// Same `{ className }` shape as next/font so call sites are unchanged.
export const mlBody = { className: styles.body };
export const mlDisplay = { className: styles.display };
export const mlScript = { className: styles.script };
