import { Baloo_Chettan_2, Chilanka, Noto_Sans_Malayalam } from "next/font/google";

// Malayalam typefaces for the Malayalam landing page. The Latin display fonts
// used by the other designs (Oswald, Dancing Script, Fraunces) have no
// Malayalam glyphs, so this variant uses its own set:
//   body    — Noto Sans Malayalam (clean, highly legible UI text)
//   display — Baloo Chettan 2 (heavy, rounded headline face)
//   script  — Chilanka (hand-lettered accent, like the hero script line)
export const mlBody = Noto_Sans_Malayalam({
  subsets: ["malayalam", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const mlDisplay = Baloo_Chettan_2({
  subsets: ["malayalam", "latin"],
  weight: ["600", "800"],
  display: "swap",
});

export const mlScript = Chilanka({
  subsets: ["malayalam", "latin"],
  weight: ["400"],
  display: "swap",
});
