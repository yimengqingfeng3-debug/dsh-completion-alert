# dsh-completion-alert

中文 | [English](README.md)

一个 [dsh](https://github.com/deepseek-ai)（DeepSeek Harness）**客户端插件**：一轮工作结束时告诉你。

- **播放提示音** —— 就是那段循环的「冰冰冰」梗音效，裁成一轮 1.06 秒的三连音，会话从"忙"变"闲"的那一刻响一次；
- **右下角弹出通知卡**，写明**哪个会话**完成了、跑了多久；
- **点一下卡片就切到那个会话**；
- **一切都能在设置里改**：总开关、提示范围、是否出声、音量、试听，以及**上传自定义提示音**。

提示音内嵌在客户端 bundle 里，所以插件不需要宿主路由、不需要磁盘资源、也不联网。通知层和设置页全部使用 dsh 自己的主题变量与 slot 体系，和桌面端观感一致。

```
一轮工作结束（会话 running: true -> false）
        │
        ├─ 按设置播放一次提示音
        └─ 右下角通知卡：「压缩图标」已完成 · 用时 1 分 12 秒
                              └─ 点击 -> uiWorkspace.openSession(id)
```

---

## 安装

### 从本仓库安装（推荐）

```powershell
git clone https://github.com/yimengqingfeng3-debug/dsh-completion-alert.git
cd dsh-completion-alert
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1            # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile web
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall
```

安装脚本是幂等的，改动前会备份：

1. 把包复制到 `<DSH_HOME>/profiles/<profile>/node_modules/dsh-completion-alert`；
2. 向该 profile 的 `cordis.patch.yml` 追加 `completion-alert` 行（如果 profile 已在本包的 `dsh.profile.bundles` 里列出，则由本包自带的 bundle patch 插入，脚本不会重复插入——重复的行 id 会直接导致启动失败）；
3. 缺少 `dsh.profile.patchReload` 时写入 `live`，之后改插件不必重启应用。

**装完刷新一次 dsh 窗口**（`Ctrl+R`），让浏览器加载新的客户端 bundle。

### 手动安装

把 `lib/`、`package.json`、`cordis.patch.yml` 复制到 profile 的 `node_modules/dsh-completion-alert`，再往 profile 的 `cordis.patch.yml` 加：

```yaml
- insert:
    - id: completion-alert
      name: 'dsh-completion-alert'
```

### 确认是否挂载

宿主半边提供一个诊断路由，浏览器半边会把自身的激活结果 POST 上去（只含挂载事实，没有会话内容、没有偏好数据）：

```
GET http://127.0.0.1:<端口>/api/completion-alert.diag
-> { "report": { "facts": { "watcher": true, "overlay": true, "settings": true } } }
```

`watcher: true` 表示完成检测接上了，`settings: true` 表示偏好已经绑到宿主设置文档。回环端口带鉴权，所以请在应用自己的控制台 / DevTools Network 里看，而不是用 curl。

---

## 设置项

**设置 → 工作完成提示**（与「通用设置」「内置插件」并列的独立一页）：

| 设置项 | 说明 |
| --- | --- |
| 启用工作完成提示 | 总开关。关掉后不出声也不弹通知 |
| 提示范围 | `全部会话`：任何会话完成都提示；`仅后台会话`：当前正在看的会话完成后不打扰 |
| 播放提示音 | 只关声音，通知照常弹 |
| 音量 | 0–100%，试听和正式提示音同时生效 |
| 试听 | 按当前设置播放一次，不改动任何配置 |
| 自定义提示音 | 上传 mp3 / wav / ogg 替换内置音（建议 3 秒内、约 2 MB 内），可一键清除 |
| 当前使用的提示音 | `内置冰冰冰` / `自定义` |

偏好存在插件自己的设置命名空间 `completion-alert`（写进 profile 的设置文档），所以**重启保留、多窗口同步**。宿主不提供设置服务时插件照常工作，选择只在当前页面生命周期内有效。

---

## 实现要点

### 1. 完成检测：订阅 `uiSession.sessionStatus`

不抓 DOM、不轮询。插件订阅客户端自己的会话状态投影 —— 侧边栏状态点、Stop 快捷键的守卫用的是同一份：

```js
status.subscribe(() => {
  // running: true -> false 就是一轮工作结束
});
```

这份投影的数据源是宿主的 `api-session/status` 事件（`agent/status` → `status === "running"`），所以**主会话、后台会话、子代理会话都会上报**。

两个刻意的规则：

- **首个快照只当基线**。窗口打开时已经有会话在跑，那不是"完成"，不会响。
- **只认 true → false 的边沿**。等审批结束的一轮、被用户 Stop 的一轮，同样是"结束了"，一样提示。

### 2. 提示音：内嵌 Ogg + Web Audio

bundle 里带一段 base64 的 Ogg（`//#region embedded-tone` 标记块），首次播放时 `decodeAudioData` 解一次并缓存；同一时刻只允许一个音源，第二次完成不会叠音。

Chromium 在页面收到用户手势前不允许启动 `AudioContext`，而这正是刚打开窗口的状态。插件**不丢弃**这一声，而是注册一次性手势解锁并在手势到来后补播，同时在角落显示"点击窗口任意位置即可开启提示音"的小胶囊。窗口被点过之后就不会再出现。

### 3. 通知与跳转

通知层注册在 `shell.overlay`（框架自带的浮层槽，`position: absolute; inset: 0`），卡片自己 `fixed` 钉在右下角，`pointer-events` 只开在卡片本身，不挡界面。

点卡片调用 `uiWorkspace.openSession(sessionId)` —— 会话浏览器、fork 会话用的是同一个入口。悬停会暂停自动消失计时，右上角 × 可以手动关掉。

### 4. 卡片配色

设置页整体跟随主题的 `--dsw-alias-*` 变量。右下角卡片额外读一次页面自身的背景色（这些变量在浮层里取不到值），深浅模式各解析一次，让卡片和当前皮肤融合，而不是一块贴上去的白块。

---

## 音频

提示音是那段流行的「冰冰冰」循环梗音效，我把它裁剪、对齐、限制到干净的一轮：

| 版本 | 文件 | 说明 |
| --- | --- | --- |
| 内嵌源 | `assets/bingbingbing.ogg` | 48 kHz 单声道 Ogg Vorbis，1.06 s，12 642 字节 |
| 打包产物 | — | 同一段 payload 内嵌在 `lib/client.js` 里 |

换成自己的提示音：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-audio.ps1 -Source C:\path\to\your-tone.ogg
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-audio.ps1 -Check   # bundle 与素材不一致时失败
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

脚本会校验 `OggS` magic，**只**重写标记块，并保持 bundle 的 UTF-8 编码。**必须是 Ogg**：Chromium 的 `decodeAudioData` 不解码 mp3，内嵌 mp3 也没有意义。跨平台等价命令：`node tools/check-embedded-tone.mjs`。

素材来源与再分发注意事项见 [NOTICE](NOTICE)；设置页允许任何终端用户运行时上传自己的提示音，这是版权不明确时推荐的做法。

---

## 目录结构

```
dsh-completion-alert/
├─ package.json             dsh.pluginType=client、dsh.client.inject、bundle patch
├─ cordis.patch.yml         把 completion-alert 行插进 profile
├─ install.ps1              安装 / 卸载（备份、patchReload=live、幂等）
├─ assets/bingbingbing.ogg  内嵌工具读取的音源
├─ lib/
│  ├─ index.js              宿主半边：volatile 设置 schema + 诊断路由
│  └─ client.js             浏览器半边：完成检测 / 播放 / 通知层 / 设置页
├─ tools/
│  ├─ embed-audio.ps1       重新内嵌音源（Windows）
│  └─ check-embedded-tone.mjs  漂移 + Ogg magic 检查（跨平台，CI 用）
└─ test/
   ├─ host.test.mjs         schema 表面、volatile 标记、诊断路由
   ├─ client.test.mjs       设置清洗、完成边沿、提示范围、持久化、跳转
   └─ loader.mjs / -hooks   给测试解析 schemastery 这个 peer 依赖
```

## 开发

```bash
npm install          # 拉取宿主半边 import 的 schemastery peer 依赖
npm test             # 35 项测试
node tools/check-embedded-tone.mjs
```

测试是行为测试而不是结构快照：客户端测试把真实 bundle 载入 `vm` 沙箱，配一个 React 桩和伪造的 dsh 客户端上下文，然后直接驱动 store 去断言真正决定行为的那些点 —— 首个快照基线、忙→闲边沿、`仅后台会话` 范围、去抖写入自己的命名空间、经 `uiWorkspace` 跳转、以及通知队列。宿主测试校验 schema 表面（包括 volatile 节点位于固定路径、其内部不再套 volatile —— 这是应用会直接拒绝的形状）和诊断路由的往返。

CI（`.github/workflows/test.yml`）在 Node 24 上跑测试与漂移检查。

## 已知限制

- **自定义音源只支持 Ogg**。mp3 会在上传时就被明确拒绝，而不是解码时静默失败。
- **同时只响一声**。上一声还没放完时来的新完成会替换它，而不是混在一起。
- **不走系统级通知**。通知是 dsh 自己的浮层卡片，因此不需要 Electron 通知权限，Web 与桌面端表现一致。
- **提示音是梗素材**。对再分发有要求的话请换成自己的音频（见 NOTICE）。

## 许可

代码 MIT —— 见 [LICENSE](LICENSE)。内嵌的音频片段是第三方素材，再分发前请读 [NOTICE](NOTICE)。
