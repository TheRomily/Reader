import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("public/covers", { recursive: true });
const wrap = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="680" viewBox="0 0 480 680"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#f2ebd9"/></linearGradient></defs><rect width="480" height="680" fill="${bg}"/>${body}<rect width="480" height="680" fill="transparent" filter="url(#grain)"/></svg>`;
const title = (small, a, b, color = "#173f3a") =>
  `<g fill="${color}" font-family="serif"><text x="42" y="58" font-size="12" letter-spacing="4">${small}</text><text x="40" y="152" font-size="59" letter-spacing="8">${a}</text>${b ? `<text x="40" y="222" font-size="59" letter-spacing="8">${b}</text>` : ""}</g>`;
const footer = (t, c = "#fff") =>
  `<text x="40" y="640" fill="${c}" font-size="12" letter-spacing="3" font-family="sans-serif">${t}</text><text x="440" y="640" fill="${c}" font-size="11" text-anchor="end">阅境原创</text>`;
writeFileSync(
  "public/covers/mountains.svg",
  wrap(
    `${title("BEYOND THE MOUNTAINS", "山海之间")}<circle cx="350" cy="270" r="56" fill="#d9a66c"/><path d="M0 421L118 236 236 405 349 301 480 432V680H0Z" fill="#8faaa0"/><path d="M0 470L164 333 310 501 401 357 480 468V680H0Z" fill="#52786d"/><path d="M0 538L105 454 193 515 315 415 480 563V680H0Z" fill="#28574e"/><path d="M230 465C363 511 76 517 205 559S367 609 288 680" stroke="#c1d1b8" stroke-width="21" fill="none"/><path d="M238 463C367 509 82 518 211 558S375 608 298 680" stroke="#e3e4cd" stroke-width="3" fill="none"/>${footer("01 / 远方来信")}`,
    "#dce5d8",
  ),
);
let windows = "";
for (let i = 0; i < 8; i++)
  for (let j = 0; j < 7; j++)
    windows += `<rect x="${30 + i * 60}" y="${290 + j * 43}" width="${i % 2 ? 15 : 23}" height="20" fill="${(i + j) % 4 === 0 ? "#eecb8b" : "#79888e"}" opacity=".65"/>`;
let rain = "";
for (let i = 0; i < 35; i++)
  rain += `<path d="M${i * 18 - 80} 250l-125 430" stroke="#bac5c7" opacity=".18" stroke-width="2"/>`;
writeFileSync(
  "public/covers/rain.svg",
  wrap(
    `${title("BEFORE THE RAIN", "雨落之前", "", "#e8e5dc")}<path d="M0 330h65v-85h88v75h94V210h92v100h69v-60h72v430H0Z" fill="#485b64"/>${windows}<path d="M0 580Q230 550 480 590V680H0Z" fill="#283e47"/><ellipse cx="275" cy="641" rx="85" ry="11" fill="#dca375" opacity=".3"/><path d="M205 530Q275 435 345 530Z" fill="#db9f77"/><path d="M275 500v111q0 21-17 8" fill="none" stroke="#e8c7a1" stroke-width="4"/><path d="M262 556h26l8 74h-42Z" fill="#d5d7ce"/>${rain}${footer("02 / 城市的温柔时刻")}`,
    "#344b55",
  ),
);
writeFileSync(
  "public/covers/moon.svg",
  wrap(
    `${title("A LETTER FROM THE MOON", "月球来信", "", "#443b62")}<circle cx="270" cy="382" r="139" fill="#e9d9c8"/><circle cx="226" cy="335" r="29" fill="#d7c5bb"/><circle cx="321" cy="409" r="48" fill="#dacbc1"/><circle cx="204" cy="432" r="17" fill="#d1c3bf"/><g fill="#fff4df">${Array.from({ length: 20 }, (_, i) => `<circle cx="${(i * 71 + 33) % 470}" cy="${(i * 109 + 220) % 620}" r="${(i % 3) + 1}"/>`).join("")}</g><ellipse cx="266" cy="410" rx="210" ry="37" fill="none" stroke="#8e83a5" stroke-width="2" transform="rotate(-28 266 410)"/><path d="M0 602Q125 540 260 598T480 569V680H0Z" fill="#8b7e9b"/><rect x="207" y="532" width="49" height="34" rx="2" fill="#f3e8d4" transform="rotate(-10 207 532)"/><path d="M208 532l24 19 25-21" fill="none" stroke="#b4a2a0"/>${footer("03 / 寄给宇宙的情书")}`,
    "#c1b6cd",
  ),
);
writeFileSync(
  "public/covers/forest.svg",
  wrap(
    `${title("INTO THE QUIET GREEN", "绿野漫游", "", "#294c3f")}<circle cx="354" cy="251" r="48" fill="#e8dc9c"/><path d="M0 410Q100 250 238 411T480 370V680H0Z" fill="#93aa6d"/><path d="M0 510Q200 309 480 460V680H0Z" fill="#5f875b"/>${[
      [-20, 240, 1.3],
      [60, 340, 0.9],
      [390, 280, 1.3],
      [310, 435, 0.7],
      [150, 430, 0.7],
    ]
      .map(
        ([x, y, s]) =>
          `<g transform="translate(${x} ${y}) scale(${s})"><path d="M40-80L0 80h23L-9 150h98L57 80h23Z" fill="#345e43"/><path d="M39 90v130" stroke="#345141" stroke-width="8"/></g>`,
      )
      .join(
        "",
      )}<path d="M242 450Q130 527 310 680" fill="none" stroke="#d8c995" stroke-width="38"/>${footer("04 / 不赶路，去感受路")}`,
    "#e3e7bf",
  ),
);
writeFileSync(
  "public/covers/days.svg",
  wrap(
    `${title("THE ART OF EVERYDAY", "寻常日子", "", "#6b4838")}<rect x="75" y="275" width="330" height="275" rx="165" fill="#e3b986"/><rect x="107" y="293" width="266" height="242" rx="133" fill="#e8d3ad"/><path d="M239 299v230M111 422h260" stroke="#bd9870" stroke-width="8"/><path d="M0 563Q250 510 480 558V680H0Z" fill="#bf886b"/><path d="M145 522h107l-12 73h-80Z" fill="#f1e5cd"/><path d="M248 533q55-8 42 35-12 26-47 7" fill="none" stroke="#f1e5cd" stroke-width="13"/><path d="M190 504q-24-24 0-43t-2-41" stroke="#f5e9d2" stroke-width="5" fill="none"/><path d="M345 541v-90q-52-55-35-88 49 4 35 77 32-57 59-39 2 43-59 50" fill="#6c8060"/>${footer("05 / 生活自有它的诗意")}`,
    "#ecd9ba",
  ),
);
writeFileSync(
  "public/covers/night.svg",
  wrap(
    `${title("A LIGHT IN THE DARK", "长夜的灯", "", "#e9debb")}<circle cx="352" cy="280" r="48" fill="#efdaad"/><path d="M0 500L143 384l108 56 119-88 110 106v222H0Z" fill="#365357"/><path d="M0 593l180-92 147 65 153-83v197H0Z" fill="#263e44"/><path d="M201 537l15-174h47l13 174Z" fill="#e2d6b3"/><path d="M208 363h63l-7-18h-48Z" fill="#ad795a"/><rect x="218" y="317" width="42" height="29" fill="#efcc7a"/><path d="M211 317l28-24 29 24Z" fill="#bb8461"/><path d="M218 322L0 240v215Z" fill="#eccc7e" opacity=".12"/><path d="M260 322l220-82v215Z" fill="#eccc7e" opacity=".12"/>${footer("06 / 总有一束光在等你")}`,
    "#244147",
  ),
);
writeFileSync(
  "public/favicon.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#245e4d"/><path d="M12 13q7-3 12 2 5-5 12-2v23q-7-3-12 1-5-4-12-1Z" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M24 15v22" stroke="#fff" stroke-width="2.5"/></svg>',
);
