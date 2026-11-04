// Badge colours for well-known clubs. Anything not listed gets a stable colour
// derived from its name, so new clubs in players.json never need code changes.
const KNOWN = {
  "Real Madrid": ["#FEBE10", "#0A1628"],
  Barcelona: ["#EDBB00", "#A50044"],
  "Atlético Madrid": ["#FFFFFF", "#CB3524"],
  "Manchester United": ["#FBE122", "#DA291C"],
  "Manchester City": ["#FFFFFF", "#6CABDD"],
  Arsenal: ["#FFFFFF", "#EF0107"],
  Chelsea: ["#FFFFFF", "#034694"],
  Liverpool: ["#FFFFFF", "#C8102E"],
  Tottenham: ["#FFFFFF", "#132257"],
  "Bayern Munich": ["#FFFFFF", "#DC052D"],
  "Borussia Dortmund": ["#000000", "#FDE100"],
  "Borussia Mönchengladbach": ["#FFFFFF", "#007A3D"],
  "Bayer Leverkusen": ["#FFFFFF", "#E32221"],
  "Schalke 04": ["#FFFFFF", "#004D9D"],
  "Werder Bremen": ["#FFFFFF", "#1D9053"],
  Kaiserslautern: ["#FFFFFF", "#C8102E"],
  Juventus: ["#FFFFFF", "#000000"],
  "AC Milan": ["#FFFFFF", "#FB090B"],
  "Inter Milan": ["#FFFFFF", "#0068A8"],
  Napoli: ["#FFFFFF", "#12A0D7"],
  Roma: ["#F5C518", "#A5000E"],
  Lazio: ["#FFFFFF", "#87CEEB"],
  Parma: ["#FFD700", "#002366"],
  Fiorentina: ["#FFFFFF", "#5B2C83"],
  Torino: ["#FFFFFF", "#8B1A1A"],
  PSG: ["#EE2523", "#003170"],
  Marseille: ["#FFFFFF", "#009BDE"],
  Monaco: ["#FFFFFF", "#CC0000"],
  Ajax: ["#FFFFFF", "#D2122E"],
  PSV: ["#FFFFFF", "#CC0000"],
  Feyenoord: ["#FFFFFF", "#CC0000"],
  Benfica: ["#FFFFFF", "#CC0000"],
  "Sporting CP": ["#FFFFFF", "#00734A"],
  Galatasaray: ["#F5A623", "#E30A17"],
  Fenerbahçe: ["#FFCC00", "#003CA6"],
  "İstanbul Başakşehir": ["#FFFFFF", "#F26B21"],
  Bursaspor: ["#FFFFFF", "#00793B"],
  Sakaryaspor: ["#FFFFFF", "#00793B"],
  "Dynamo Kyiv": ["#FFFFFF", "#0057B8"],
  "LA Galaxy": ["#FFD700", "#00245D"],
  "Inter Miami": ["#F7B5CD", "#231F20"],
  "Al Nassr": ["#FFD700", "#00539F"],
  Santos: ["#FFFFFF", "#000000"],
  Flamengo: ["#CC0000", "#000000"],
  Corinthians: ["#FFFFFF", "#000000"],
};

function hashHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** → { fg, bg } for the little club badge. */
export function clubColors(name) {
  const hit = Object.keys(KNOWN).find((k) => name.includes(k));
  if (hit) return { fg: KNOWN[hit][0], bg: KNOWN[hit][1] };
  const hue = hashHue(name);
  return { fg: "#FFFFFF", bg: `hsl(${hue} 55% 38%)` };
}

/** "Manchester United" → "MU", "Ajax" → "AJA" */
export function clubInitials(name) {
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
