// Illustrated portraits for the fictional demo patients, plus bundled photo overrides where provided.
import joshuaBirdAvatar from "../../assets/portraits/joshua-bird.jpg?inline";

type Hair = "short" | "crop" | "bob" | "long" | "bun" | "curly" | "receding" | "bald";

interface PortraitSpec {
  skin: string;
  hair: string;
  style: Hair;
  shirt: string;
  bg: string;
  glasses?: boolean;
}

const SKIN = { light: "#f1cfb4", fair: "#e8bf9c", medium: "#c98f66", tan: "#b07650", brown: "#8a5a3c" };
const HAIR = { white: "#d6d1c8", grey: "#b4b0aa", greyDark: "#7d7873", black: "#2b2522", brown: "#5b3b28", darkBrown: "#3d2a20" };

const SPECS: Record<string, PortraitSpec> = {
  "mary-thompson": { skin: SKIN.light, hair: HAIR.grey, style: "bob", shirt: "#4f6d8f", bg: "#e7edf3" },
  "robert-bird": { skin: SKIN.tan, hair: HAIR.greyDark, style: "short", shirt: "#4b6b5a", bg: "#e6eee9" },
  "daljit-kaur": { skin: SKIN.medium, hair: HAIR.black, style: "bun", shirt: "#8a4f6b", bg: "#f1e8ec" },
  "james-lee": { skin: SKIN.fair, hair: HAIR.black, style: "crop", shirt: "#3f5872", bg: "#e6ebf1" },
  "evelyn-morin": { skin: SKIN.light, hair: HAIR.white, style: "curly", shirt: "#7a6a9a", bg: "#ece9f2" },
  "frank-olson": { skin: SKIN.light, hair: HAIR.grey, style: "bald", shirt: "#6b5f4f", bg: "#efebe5", glasses: true },
  "grace-ahenakew": { skin: SKIN.tan, hair: HAIR.greyDark, style: "long", shirt: "#2f6d73", bg: "#e4eff0" },
  "arthur-lavallee": { skin: SKIN.fair, hair: HAIR.grey, style: "receding", shirt: "#5a6878", bg: "#e8ebef", glasses: true },
  "helen-kowalchuk": { skin: SKIN.light, hair: HAIR.white, style: "bun", shirt: "#9a5d4f", bg: "#f2e9e6", glasses: true },
  "priya-natarajan": { skin: SKIN.brown, hair: HAIR.black, style: "long", shirt: "#4d5f8f", bg: "#e8eaf3" },
  "walter-sinclair": { skin: SKIN.fair, hair: HAIR.white, style: "receding", shirt: "#55705f", bg: "#e7eee9" },
  // marie-gauthier intentionally has no portrait: shows the initials fallback
};

function hairBack(s: PortraitSpec): string {
  switch (s.style) {
    case "long":
      return `<path d="M22 40c0-14 8-24 18-24s18 10 18 24v26H22z" fill="${s.hair}"/>`;
    case "bob":
      return `<path d="M23 42c0-15 7-25 17-25s17 10 17 25v8c0 3-3 4-5 4H28c-2 0-5-1-5-4z" fill="${s.hair}"/>`;
    case "bun":
      return `<circle cx="40" cy="15" r="7.5" fill="${s.hair}"/>`;
    default:
      return "";
  }
}

function hairFront(s: PortraitSpec): string {
  switch (s.style) {
    case "short":
      return `<path d="M27 36c0-10 6-16 13-16s13 6 13 16c-3-5-8-7-13-7s-10 2-13 7z" fill="${s.hair}"/>`;
    case "crop":
      return `<path d="M27.5 35c0-9 5.5-15 12.5-15s12.5 6 12.5 15c-2-3-6-6-12.5-6s-10.5 3-12.5 6z" fill="${s.hair}"/>`;
    case "bob":
    case "long":
      return `<path d="M27 37c1-10 6-16 13-16s12 6 13 16c-4-6-9-8-15-8-4 0-8 3-11 8z" fill="${s.hair}"/>`;
    case "bun":
      return `<path d="M27 36c0-10 6-15 13-15s13 5 13 15c-3-5-7-7-13-7s-10 2-13 7z" fill="${s.hair}"/>`;
    case "curly":
      return `<g fill="${s.hair}"><circle cx="30" cy="30" r="5"/><circle cx="35" cy="25" r="5.5"/><circle cx="41" cy="23.5" r="5.5"/><circle cx="47" cy="26" r="5.5"/><circle cx="51" cy="31" r="4.5"/><circle cx="28" cy="36" r="3.5"/><circle cx="52" cy="37" r="3.5"/></g>`;
    case "receding":
      return `<path d="M27 38c0-6 2-10 5-12-1 4-1 8 0 12zM53 38c0-6-2-10-5-12 1 4 1 8 0 12z" fill="${s.hair}"/>`;
    case "bald":
      return `<path d="M27 40c0-3 .5-6 2-8v9zM53 40c0-3-.5-6-2-8v9z" fill="${s.hair}"/>`;
  }
}

function svg(s: PortraitSpec): string {
  const glasses = s.glasses
    ? `<g fill="none" stroke="#3b3a39" stroke-width="1.2"><rect x="31" y="37" width="7.5" height="5.5" rx="2.4"/><rect x="41.5" y="37" width="7.5" height="5.5" rx="2.4"/><path d="M38.5 39.5h3"/></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
<rect width="80" height="80" fill="${s.bg}"/>
${hairBack(s)}
<path d="M14 80c0-14 11-22 26-22s26 8 26 22z" fill="${s.shirt}"/>
<path d="M34 52h12v9c0 3-3 5-6 5s-6-2-6-5z" fill="${s.skin}"/>
<path d="M34 58c2 2 4 3 6 3s4-1 6-3v2c-2 2-4 3-6 3s-4-1-6-3z" fill="#000" opacity=".08"/>
<ellipse cx="40" cy="39" rx="13" ry="15.5" fill="${s.skin}"/>
<ellipse cx="27.3" cy="40" rx="2.2" ry="3.2" fill="${s.skin}"/>
<ellipse cx="52.7" cy="40" rx="2.2" ry="3.2" fill="${s.skin}"/>
${hairFront(s)}
<g fill="#2e2a28"><ellipse cx="35" cy="39.8" rx="1.3" ry="1.5"/><ellipse cx="45" cy="39.8" rx="1.3" ry="1.5"/></g>
<path d="M36.5 47.5c2 1.4 5 1.4 7 0" fill="none" stroke="#7a4a3a" stroke-width="1.2" stroke-linecap="round"/>
${glasses}
</svg>`;
}

const PHOTOS: Record<string, string> = {
  "robert-bird": joshuaBirdAvatar,
};

const cache = new Map<string, string>();

/** Image URL or data URI for a patient's portrait, or undefined when none is on file. */
export function portraitFor(patientId: string): string | undefined {
  if (PHOTOS[patientId]) return PHOTOS[patientId];
  const spec = SPECS[patientId];
  if (!spec) return undefined;
  let uri = cache.get(patientId);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(spec))}`;
    cache.set(patientId, uri);
  }
  return uri;
}
