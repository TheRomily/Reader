import type { Book, ReadableBook } from "../types";

const stories = [
  {
    title: "山海之间",
    author: "林间工作室",
    cover: "mountains",
    category: "comic",
    format: "CBZ",
    color: "#789687",
    intro: "第一个清晨，风从山的另一边吹来。",
    lines: [
      "我想去看看，山的那一边。",
      "你看，风已经替我们出发了。",
      "原来，走慢一点，也能遇见整个世界。",
      "山很安静。海也是。",
      "有些答案，要走很远才能听见。",
      "那些寻常的风景，都成了心里的回声。",
      "直到看见海，才懂得山的辽阔。",
      "下一次，我们再一起出发。",
    ],
  },
  {
    title: "雨落之前",
    author: "小岛绘",
    cover: "rain",
    category: "comic",
    format: "CBZ",
    color: "#768b93",
    intro: "这座城市有一千种声音，雨声最温柔。",
    lines: [
      "今天的天气预报说，有人会遇见温柔。",
      "最后一班电车，刚好赶上。",
      "你把伞留给了陌生人。",
      "街角的灯，比昨天亮了一点。",
      "谢谢你，让这座城市不那么陌生。",
      "等雨停了，我们去吃碗热面吧。",
      "原来日常里，也藏着奇迹。",
      "明天见。",
    ],
  },
  {
    title: "月球来信",
    author: "月光邮局",
    cover: "moon",
    category: "comic",
    format: "CBZ",
    color: "#aca0b7",
    intro: "亲爱的地球居民，这是一封来自很远的地方的信。",
    lines: [
      "今天，我在月球上种下了第一朵花。",
      "地球看起来，是蓝色的。",
      "听说你们那里，春天快到了。",
      "这里的日落，很慢很慢。",
      "我把想念藏在了星星里。",
      "不知道你抬头的时候，能不能看见。",
      "宇宙很大，可我总是想到你。",
      "愿下一次来信，能说好久不见。",
    ],
  },
  {
    title: "绿野漫游",
    author: "山川与木",
    cover: "forest",
    category: "comic",
    format: "CBZ",
    color: "#93aa6d",
    intro: "不赶路，去感受路。",
    lines: [
      "把手机放进口袋，听。",
      "是风走过森林的声音。",
      "跟着小溪，再走一段吧。",
      "这棵树，大概记得一百个春天。",
      "一只松鼠给我们指了路。",
      "我们在草地上，坐了一整个下午。",
      "回去的路上，口袋里装满了阳光。",
      "大自然从来不催我们。",
    ],
  },
  {
    title: "寻常日子",
    author: "一日生活编辑部",
    cover: "days",
    category: "ebook",
    format: "EPUB",
    color: "#bf886b",
    intro: "生活自有它的诗意。",
    lines: [
      "关于一杯热茶",
      "把时间还给自己",
      "窗台上的小花园",
      "一个人的晚饭",
      "去附近散步",
      "给朋友写一封信",
      "收藏微小的快乐",
      "明天也是好日子",
    ],
  },
  {
    title: "长夜的灯",
    author: "远岸",
    cover: "night",
    category: "ebook",
    format: "EPUB",
    color: "#365357",
    intro: "总有一束光在等你。",
    lines: [
      "灯塔守望者",
      "海风的名字",
      "岛上的第三个人",
      "一封没有寄出的信",
      "冬天的渡轮",
      "暴风雨之后",
      "看见远方",
      "灯一直亮着",
    ],
  },
] as const;
export const demoBooks: Book[] = stories.map((story, i) => ({
  id: `demo-${i}`,
  title: story.title,
  author: story.author,
  cover: `/covers/${story.cover}.svg`,
  category: story.category,
  format: story.format,
  demo: i,
  size: 0,
  addedAt: Date.now() - i * 1000,
  page: 0,
  total: 8,
  favorite: false,
}));
export function createDemo(index: number): ReadableBook {
  const s = stories[index];
  const urls: string[] = [];
  return {
    length: 8,
    chapters: s.lines.map((label, index) => ({ label, index })),
    unit: s.category === "ebook" ? "章" : "页",
    getPage: async (page) => {
      if (s.category === "ebook")
        return {
          kind: "html",
          html: `<article><p class="eyebrow">阅境原创示例 · ${s.title}</p><h1>${s.lines[page]}</h1><p>${s.intro}</p>${Array.from({ length: 9 }, (_, j) => `<p>${["清晨的阳光从窗帘的缝隙里溜进来，在木地板上画出一道细长的光。水壶发出轻轻的声音，新的一天就这样开始了。", "我们总是习惯匆匆忙忙，忙着追赶，忙着抵达。偶尔停下来才发现，路边的树已经换了一身新绿，而那家小小的面包店，依然在每天早晨准时打开门。", "生活里值得记住的事情，往往都是很小的事。比如某个下午，一杯温度刚刚好的茶，一本翻到恰好那一页的书，还有远方朋友发来的一句问候。", "也许我们需要的，并不是更多的时间，而是更认真地感受此刻。在这安静的片刻里，世界变得柔软，心也慢慢安定下来。"][(page + j) % 4]}</p>`).join("")}<p>—— ${s.author}</p></article>`,
        };
      const c = s.color;
      const stars = Array.from(
        { length: 17 },
        (_, i) =>
          `<circle cx="${((i * 123 + page * 71) % 680) + 25}" cy="${((i * 91) % 340) + 40}" r="${(i % 3) + 1}" fill="#f9f3e2" opacity=".7"/>`,
      ).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1100" viewBox="0 0 780 1100"><rect width="780" height="1100" fill="#f6f0e3"/><text x="42" y="43" font-size="13" letter-spacing="4" fill="#757c6b" font-family="sans-serif">${s.title} · 阅境原创示例</text><g stroke="#354c44" stroke-width="2"><rect x="40" y="68" width="700" height="420" fill="${c}"/>${stars}<circle cx="550" cy="182" r="59" fill="#e9d6aa"/><path d="M40 375l170-163 148 159 148-112 234 180v49H40Z" fill="#c6cdb7"/><path d="M40 434l250-139 170 151 160-100 120 114v28H40Z" fill="#45665a"/><path d="M372 425q83 22-1 63" stroke="#e2d9b9" stroke-width="13" fill="none"/><rect x="40" y="512" width="338" height="300" fill="#d9decc"/><rect x="402" y="512" width="338" height="300" fill="${c}"/><path d="M41 762q130-198 336-63v113H41" fill="#7e9580"/><path d="M209 560v201m0-123q-92-46-93-91 81-9 93 91m0 33q91-35 96-84-84-22-96 84" fill="#4f715a"/><circle cx="575" cy="602" r="37" fill="#e4d4b2"/><path d="M476 774l100-132 105 132" fill="#d4d7c4"/><circle cx="577" cy="685" r="15" fill="#c49f80"/><path d="M562 704h29l12 57h-52Z" fill="#3f5c50"/><path d="M569 760l-11 38m26-38 13 38" fill="none" stroke="#3f5c50" stroke-width="7"/><rect x="40" y="836" width="700" height="196" fill="#e4e4d2"/><path d="M40 978q183-134 350-16t350-34v104H40Z" fill="#97a68a"/></g><rect x="88" y="91" width="${Math.min(570, s.intro.length * 23 + 30)}" height="54" rx="2" fill="#fffdf4"/><text x="103" y="127" font-size="22" fill="#354c44" font-family="serif">${s.intro}</text><rect x="100" y="870" width="580" height="64" fill="#fffdf4"/><text x="390" y="911" text-anchor="middle" font-size="24" fill="#354c44" font-family="serif">${s.lines[page]}</text><text x="390" y="1074" text-anchor="middle" fill="#7c8371" font-size="14">— ${page + 1} —</text></svg>`;
      const src = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml" }),
      );
      urls.push(src);
      return { kind: "image", src };
    },
    destroy: () => urls.forEach((url) => URL.revokeObjectURL(url)),
  };
}
