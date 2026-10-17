# 阅境 Reader

为漫画与电子书打造的本地阅读器。采用 React + TypeScript，提供浏览器版与 Electron 桌面版，适配 **macOS（Apple Silicon / Intel）与 Windows x64**。

macOS arm64 本机试用包：[2026-10-17 R3 预发布](https://github.com/TheRomily/Reader/releases/tag/mac-local-trial-20261017-r3)。该包采用 ad-hoc 签名，未进行 Apple 公证。安装到 Applications 后的本机正常启动与基本阅读检查已通过；详见[验收报告](docs/acceptance/2026-10-17-r3.html)及[机器可读结果](docs/acceptance/2026-10-17-r3.json)。

![阅境书架](docs/library.png)

## 已实现的功能

- **私人书架**：批量导入、拖放、文件夹导入（多张图片自动合为一本漫画）、内容分类、搜索、排序、网格/列表视图、收藏、自定义分组和书籍重命名。可在书籍详情中把漫画 PDF 归入漫画分类。
- **漫画阅读**：单页、双页、连续滚动、左右阅读方向、页面适配、缩放、全屏、亮度调整、自动滚动，以及图片的自然页码排序。
- **电子书阅读**：章节目录、可调字号、明亮/护眼/夜间主题、系统语音朗读当前章节。
- **阅读记录**：自动保存进度、书签、每页/章的笔记、最近阅读、实际前台阅读时长和统计。
- **格式转换**：浏览器中将文字书籍导出为 EPUB / TXT；桌面版通过本机 Calibre 转换为 EPUB、PDF、MOBI、AZW3、TXT。
- **本地优先**：书籍二进制文件和阅读数据存储于 IndexedDB，偏好设置保存在 localStorage。无服务器、无账户、无自动上传。字体、PDF Worker 和解压引擎随应用打包。
- 内置 6 本可直接打开的原创示例书，封面与内容均为本项目生成，并明确标注为示例。

## 格式支持

| 类型       | 可直接打开的格式                          | 说明                                                                 |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------- |
| 漫画压缩包 | CBZ / ZIP、CBR / RAR、CB7 / 7Z、CBT / TAR | 读取包内图片，按自然页码排序；RAR、7Z、TAR 使用本地 WebAssembly 引擎 |
| 电子书     | EPUB、MOBI、AZW、AZW3 / KF8、FB2          | 无 DRM 文件；读取章节与插图，统一为舒适阅读排版                      |
| 文档       | PDF、TXT、MD、HTML / HTM                  | PDF 使用 PDF.js；TXT 自动尝试 UTF-8、GB18030；MD 作为纯文字阅读      |
| 图片       | JPG / JPEG、PNG、WebP、GIF、AVIF、BMP     | 支持程度取决于内置 Chromium 或浏览器的图片解码器                     |
| 需先转换   | CHM、DOCX、RTF、ODT 等                    | 桌面版选择原文件，通过 Calibre 转成 EPUB 后导入                      |

格式支持并不等于完整还原原书样式：EPUB、Kindle 与 FB2 使用统一排版，复杂 CSS、交互内容、音视频、数学排版或特殊固定版式可能无法完整保留。PDF 按原页面显示，当前未提供文字搜索、选区、OCR 或朗读。无 DRM 移除能力；密码 PDF 与加密压缩包需先合法解锁。单个导入文件上限为 300 MB、漫画最多 10,000 页。

## 启动浏览器版

建议安装 **Node.js 24 LTS**（最低 22.12）。

```bash
npm ci
npm run dev
```

生产构建与本地预览：

```bash
npm run build
npm run preview
```

应通过本地开发服务器或 HTTPS 使用浏览器版，避免直接双击 `index.html`。开发服务器默认端口为 5173。本地文件、工作进程与字体均无需远程 CDN。已构建的桌面版可在无网络时阅读本地书籍。

## 启动 Mac / Windows 桌面版

```bash
npm ci
npm run desktop
```

首次启动会按当前系统下载 Electron，并校验发行文件；后续直接使用已安装的运行时。桌面版使用自定义 `reader://` 协议加载打包资源，启用上下文隔离、渲染进程沙箱，关闭 Node.js 集成，并限制导航、弹窗与权限。

### Mac 本机试用（暂无开发者证书）

```bash
npm run mac:check
npm run mac:trial
```

仅在 Mac 上执行。自动生成 ad-hoc 签名的本机试用应用与 DMG，校验签名，并从 DMG 中启动独立书库的桌面验收。流程和人工验收项见 [Mac 本机试用指南](docs/MAC_TRIAL.md)。2026-10-17 R2 已修复双页上下堆叠，9 项浏览器回归、12 组补充桌面检查与 6 份真实漫画文档的读取及重启恢复通过，144 组双页布局断言通过。R3 已安装到 `/Applications/阅境.app` 并验证正常启动，安装版独立书库的代表性 PDF/MOBI、48 组布局和重启恢复通过。实际 Calibre 转换与语音出声未测；[公开验收报告](docs/acceptance/2026-10-17-r3.html)保留测试范围，完整本机证据位于 `release/`。

### 在对应系统生成安装包

macOS：

```bash
npm run package:mac -- --arm64
# Intel Mac 使用 --x64
```

Windows：

```powershell
npm run package:win
```

产物位于 `release/`：Mac 为 DMG / ZIP，Windows 为 NSIS 安装程序 / 便携 EXE。仓库中的 `.github/workflows/desktop.yml` 可手动触发，也会在推送 `v*` 标签后构建 Mac arm64、Mac x64、Windows x64 三组产物。工作流只上传构建产物，不自动发布。

当前配置生成未签名的测试包。正式分发需为 Mac 配置 Apple Developer 签名和公证，为 Windows 配置代码签名。Mac 和 Windows 的系统兼容性与安装体验须在相应系统上验收；Linux 中的 Electron 启动验证不替代这一步。

### 启用桌面格式转换

1. 从 [Calibre 官网](https://calibre-ebook.com/download)安装 Calibre。
2. 打开阅境侧边栏的「格式转换」。应用会查找 Mac 的 `/Applications/calibre.app/Contents/MacOS/ebook-convert` 和 Windows 标准安装位置。
3. 如果安装在其他位置，点击「选择程序」，选择 `ebook-convert` / `ebook-convert.exe`。
4. 选择原文件、目标格式与保存位置。转换在本机执行，支持取消，最长运行 10 分钟，不覆盖选定的原文件。

Calibre 不随应用分发；浏览器版无需安装它。浏览器转换仅提取文字与章节，不保留插图和原书排版。桌面转换的格式质量由源文件与 Calibre 决定。

## 操作与数据

- `←` / `→`：翻页；日漫方向下相应反转。
- `空格`：下一页；`B`：添加/取消书签；`F`：全屏；`Esc`：返回书架。
- `/`：聚焦书架搜索。
- 点击书籍旁的 `···`：重命名、调整内容分类、加入分组或移出书架。
- 朗读使用操作系统的语音服务。需安装相应语言的系统语音；当前按章节启动，不对图片漫画进行 OCR 朗读。
- 阅读时长按应用在前台打开阅读器的时间计算，不冒充实际注意力时长。

书库保存在**当前浏览器配置或桌面应用用户数据目录**，不会跨浏览器、设备或浏览器版/桌面版自动同步。清除站点数据、移除应用数据或隐私模式结束可能删除书库；请保留书籍原文件和重要笔记副本。浏览器存储容量受系统配额限制。

## 验证

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm test` 检查真实 EPUB / MOBI / FB2 / TXT / CBZ 的解析、旧 MOBI 元数据兼容、GB 编码、DRM 拒绝与 HTML 清理。浏览器测试覆盖 PDF、漫画与电子书渲染、WASM 解压、章节链接、书签笔记与进度恢复、RTL、连续阅读、主题、手机布局，以及 TXT → EPUB 的转换回读。

受限环境中可将 `CHROMIUM_EXECUTABLE` 指向已有的 Chromium 来运行端到端测试。桌面入口的语法可用 `node --check desktop/main.cjs` 与 `node --check desktop/preload.cjs` 检查。

## 项目结构

```text
src/
  App.tsx                  书架、导入、分组、设置、统计
  components/Reader.tsx    阅读器、导航、书签、笔记、朗读和滚动
  components/Converter.tsx 文字转换与桌面转换界面
  lib/formats.ts           多格式解析与资源释放
  lib/storage.ts           本地数据持久化
  lib/demo.ts              原创示例内容
  styles.css               自适应界面与阅读主题
desktop/                  Electron 入口与受限 IPC 桥接
tests/                    格式测试、真实文件生成器与浏览器测试
```

主要组件：PDF.js、Foliate MOBI/KF8 解析器、JSZip、libarchive.js、DOMPurify、Lucide、Noto 字体。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

项目许可证：[Apache-2.0](LICENSE)。
