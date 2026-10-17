const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  net,
} = require("electron");
const { spawn } = require("node:child_process");
const { access, readFile, writeFile, realpath } = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "reader",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
app.setName("阅境");
let mainWindow;
let calibrePath;
let conversion;
const sources = new Map();
const dist = path.join(__dirname, "..", "dist");
const devUrl = process.env.READER_DEV_URL;
const mainUrl =
  devUrl && /^http:\/\/(localhost|127\.0\.0\.1):5173\/?$/.test(devUrl)
    ? devUrl
    : "reader://app/index.html";
const formats = new Set(["epub", "pdf", "mobi", "azw3", "txt"]);
const inputExtensions = [
  "epub",
  "mobi",
  "azw",
  "azw3",
  "pdf",
  "fb2",
  "txt",
  "html",
  "htm",
  "chm",
  "docx",
  "rtf",
  "odt",
  "cbz",
  "cbr",
  "lit",
  "pdb",
  "lrf",
  "rb",
  "snb",
  "tcr",
];
function assertSender(event) {
  if (
    event.senderFrame !== mainWindow?.webContents.mainFrame ||
    event.senderFrame.url.split("#")[0] !== mainUrl.split("#")[0]
  )
    throw new Error("Untrusted sender");
}
async function findCalibre() {
  if (calibrePath) return calibrePath;
  try {
    const saved = JSON.parse(
      await readFile(
        path.join(app.getPath("userData"), "converter.json"),
        "utf8",
      ),
    );
    if (
      typeof saved.path === "string" &&
      /^ebook-convert(?:\.exe)?$/i.test(path.basename(saved.path))
    ) {
      await access(saved.path);
      return (calibrePath = saved.path);
    }
  } catch {}
  const options =
    process.platform === "darwin"
      ? ["/Applications/calibre.app/Contents/MacOS/ebook-convert"]
      : process.platform === "win32"
        ? [
            path.join(
              process.env.ProgramFiles || "C:\\Program Files",
              "Calibre2",
              "ebook-convert.exe",
            ),
            path.join(
              process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
              "Calibre2",
              "ebook-convert.exe",
            ),
          ]
        : ["/usr/bin/ebook-convert", "/opt/calibre/ebook-convert"];
  for (const candidate of options) {
    try {
      await access(candidate);
      return (calibrePath = candidate);
    } catch {}
  }
  return null;
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 920,
    minWidth: 780,
    minHeight: 600,
    backgroundColor: "#f8f9f6",
    title: "阅境 · 让阅读自成一境",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.split("#")[0] !== mainUrl.split("#")[0]) event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  void mainWindow.loadURL(mainUrl);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: "阅境",
              submenu: [
                { role: "about", label: "关于阅境" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { type: "separator" },
                { role: "quit", label: "退出阅境" },
              ],
            },
          ]
        : []),
      {
        label: "编辑",
        submenu: [
          { role: "undo", label: "撤销" },
          { role: "redo", label: "重做" },
          { type: "separator" },
          { role: "cut", label: "剪切" },
          { role: "copy", label: "复制" },
          { role: "paste", label: "粘贴" },
          { role: "selectAll", label: "全选" },
        ],
      },
      {
        label: "视图",
        submenu: [
          { role: "reload", label: "重新加载" },
          { type: "separator" },
          { role: "resetZoom", label: "实际大小" },
          { role: "zoomIn", label: "放大界面" },
          { role: "zoomOut", label: "缩小界面" },
          { type: "separator" },
          { role: "togglefullscreen", label: "切换全屏" },
          ...(!app.isPackaged
            ? [{ role: "toggleDevTools", label: "开发者工具" }]
            : []),
        ],
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize", label: "最小化" },
          { role: "close", label: "关闭窗口" },
        ],
      },
    ]),
  );
}
ipcMain.handle("converter:status", async (event) => {
  assertSender(event);
  return { available: !!(await findCalibre()) };
});
ipcMain.handle("converter:choose", async (event) => {
  assertSender(event);
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "选择 Calibre 的 ebook-convert 程序",
    properties: ["openFile"],
    ...(process.platform === "win32"
      ? { filters: [{ name: "Calibre 转换程序", extensions: ["exe"] }] }
      : {}),
  });
  if (!selection.canceled && selection.filePaths[0]) {
    const selected = selection.filePaths[0];
    if (!/^ebook-convert(?:\.exe)?$/i.test(path.basename(selected)))
      return { available: false };
    await access(selected);
    calibrePath = selected;
    await writeFile(
      path.join(app.getPath("userData"), "converter.json"),
      JSON.stringify({ path: selected }),
    );
  }
  return { available: !!(await findCalibre()) };
});
ipcMain.handle("converter:source", async (event) => {
  assertSender(event);
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "选择需要转换的书籍",
    properties: ["openFile"],
    filters: [{ name: "电子书与文档", extensions: inputExtensions }],
  });
  if (selection.canceled) return null;
  const selected = selection.filePaths[0];
  if (!inputExtensions.includes(path.extname(selected).slice(1).toLowerCase()))
    return null;
  sources.clear();
  const token = randomUUID();
  sources.set(token, selected);
  return { token, name: path.basename(selected) };
});
ipcMain.handle("converter:cancel", (event) => {
  assertSender(event);
  conversion?.kill();
});
ipcMain.handle("converter:run", async (event, options) => {
  assertSender(event);
  if (
    !options ||
    !formats.has(options.format) ||
    typeof options.token !== "string" ||
    !sources.has(options.token)
  )
    return { ok: false, error: "请重新选择文件与输出格式。" };
  if (conversion) return { ok: false, error: "已有转换任务正在进行。" };
  const command = await findCalibre();
  if (!command)
    return {
      ok: false,
      error: "未找到 Calibre，请先安装或选择 ebook-convert 程序。",
    };
  const input = sources.get(options.token);
  const selection = await dialog.showSaveDialog(mainWindow, {
    title: "保存转换后的书籍",
    defaultPath:
      path.basename(input, path.extname(input)) + "." + options.format,
    filters: [
      { name: options.format.toUpperCase(), extensions: [options.format] },
    ],
  });
  if (selection.canceled || !selection.filePath) return { cancelled: true };
  let output = selection.filePath;
  if (!output.toLowerCase().endsWith("." + options.format))
    output += "." + options.format;
  const canonicalInput = await realpath(input);
  const canonicalOutput = await realpath(output).catch(() =>
    path.resolve(output),
  );
  const normalizePath = (value) =>
    process.platform === "win32" || process.platform === "darwin"
      ? value.normalize("NFC").toLowerCase()
      : value;
  if (normalizePath(canonicalInput) === normalizePath(canonicalOutput))
    return { ok: false, error: "请选择不同的文件名，以保留原始文件。" };
  if (output !== selection.filePath) {
    const exists = await access(output).then(
      () => true,
      () => false,
    );
    if (exists) {
      const answer = await dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "文件已经存在",
        message: "输出文件已存在，是否替换？",
        buttons: ["取消", "替换"],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response !== 1) return { cancelled: true };
    }
  }
  return new Promise((resolve) => {
    let tail = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, [input, output], {
      shell: false,
      windowsHide: true,
    });
    conversion = child;
    const timeout = setTimeout(
      () => {
        timedOut = true;
        child.kill();
      },
      10 * 60 * 1000,
    );
    child.stdout?.on("data", (data) => {
      tail = (tail + data.toString()).slice(-2400);
    });
    child.stderr?.on("data", (data) => {
      tail = (tail + data.toString()).slice(-2400);
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      conversion = undefined;
      resolve(result);
    };
    child.once("error", () =>
      finish({
        ok: false,
        error: "无法启动 Calibre，请检查程序路径和系统权限。",
      }),
    );
    child.once("close", (code, signal) => {
      if (timedOut)
        finish({
          ok: false,
          error: "转换超过 10 分钟，已停止。请检查文件大小或转换格式。",
        });
      else if (signal || code === null) finish({ cancelled: true });
      else if (code === 0) finish({ ok: true });
      else
        finish({
          ok: false,
          error: /DRM|encrypted/i.test(tail)
            ? "文件受 DRM 或密码保护，无法转换。"
            : `Calibre 转换失败（退出码 ${code}），请确认该格式受支持且文件完整。`,
        });
    });
  });
});
app.whenReady().then(() => {
  protocol.handle("reader", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== "app") return new Response("Not found", { status: 404 });
      const target = path.resolve(dist, "." + decodeURIComponent(url.pathname));
      const relative = path.relative(dist, target);
      if (relative.startsWith("..") || path.isAbsolute(relative))
        return new Response("Forbidden", { status: 403 });
      return await net.fetch(pathToFileURL(target).href);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => conversion?.kill());
