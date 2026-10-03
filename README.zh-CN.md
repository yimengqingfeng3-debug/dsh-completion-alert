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

### 从 registry 装（插件管理器的做法）

```
dsh-completion-alert
```

把这个名字填进 **设置 → 内置插件 → 安装**。插件管理器会在 profile 里跑 `pnpm add`，记下依赖，并把这个包列进 `dsh.profile.bundles`。

### 从本仓库安装（本地检出，不走包管理器）

```powershell
git clone https://github.com/yimengqingfeng3-debug/dsh-completion-alert.git
cd dsh-completion-alert
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1            # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile web
```

安装脚本是幂等的，改动前会备份：

1. 把包复制到 `<DSH_HOME>/profiles/<profile>/node_modules/dsh-completion-alert`；
2. 向该 profile 的 `cordis.patch.yml` 追加 `completion-alert` 行（如果 profile 已在本包的 `dsh.profile.bundles` 里列出，则由本包自带的 bundle patch 插入，脚本不会重复插入——重复的行 id 会直接导致启动失败）；
3. 缺少 `dsh.profile.patchReload` 时写入 `live`，之后改插件不必重启应用。

**装完刷新一次 dsh 窗口**（`Ctrl+R`），让浏览器加载新的客户端 bundle。

### 手动安装

把 `lib/`、`assets/`、`package.json`、`cordis.patch.yml` 复制到 profile 的 `node_modules/dsh-completion-alert`，再往 profile 的 `cordis.patch.yml` 加：

```yaml
- insert:
    - id: completion-alert
      name: 'dsh-completion-alert'
```

---

## 卸载

三条路都实测过，**都不需要插件本身配合**，也都不碰其他插件。

### 1. 插件面板自带的卸载按钮

**设置 → 内置插件 → dsh-completion-alert → 卸载。** 它会摘掉 bundle 登记与 patch 行（插件立刻不再加载），然后让 pnpm 删包。

最后那一步有个已知问题：插件管理器调用的是 **app 自带的 pnpm（11.7.0）**，而这个版本在包发布不满 24 小时时会**忽略** profile 里的 `minimumReleaseAgeExclude` 豁免名单，于是 `pnpm remove` 可能报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`，界面显示"卸载失败" —— 尽管插件其实已经卸载了。PATH 上的 pnpm 12 认这份名单，同一条命令手跑就能过。

无论哪种结果，界面自身状态是对的；可能留下的是 `node_modules` 里的那份拷贝和 `package.json` / `pnpm-lock.yaml` 里的条目 —— 下面两条路专门清这个。

### 2. 彻底清理脚本（界面报错时推荐）

**关掉 dsh**，然后：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1                 # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1 -Profile web
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1 -WhatIf        # 只打印计划，不改任何文件
```

它删除**并验证**以下每一处痕迹：

| 位置 | 清掉什么 |
| --- | --- |
| `node_modules/dsh-completion-alert` | 包目录 |
| `cordis.patch.yml` | 所有 `completion-alert` insert 行（安装失败可能留下不止一份） |
| `package.json` | 依赖条目（如果插件管理器加过） |
| `pnpm-lock.yaml` | importer 条目 + `packages:` / `snapshots:` 块 |
| `pnpm-workspace.yaml` | 本包的 `minimumReleaseAgeExclude` 那一行 |

每个被改写的文件都会备份到 `<profile>\.completion-alert-backup\`；它会逐项打印**故意没动**的东西（余额插件的目录、依赖、豁免、lockfile 条目都报告为 kept），最后再跑一次"应为空"的扫描，列出任何没清掉的引用。**务必在 dsh 关闭时运行**：应用运行期间占着 profile，退出时还可能把同样的文件写回去。

### 3. 手动删

删掉 `node_modules/dsh-completion-alert`，从 `cordis.patch.yml` 移除它的 `- insert:` 行，从 `package.json` 里去掉 `"dsh-completion-alert"`（`dsh.profile.bundles` 与 `dependencies` 两处），再清掉 `pnpm-lock.yaml` 里的条目。留着 lockfile 条目不会致命（pnpm 会报"lockfile 不是最新"，而不是做错事），上面那个脚本存在的意义就是让你不必手动做这些。

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
| 后台时全部提示 | 只在选了「仅后台会话」时有意义：应用被切到后台或最小化后，屏幕上其实什么都没在看，于是任何会话完成都提示。这一行会显示当前状态；选「全部会话」时它是灰的 |
| 手动停止也提示 | 默认关闭：自己点「停止」结束的一轮不弹通知也不出声，只有正常跑完的才提示 |
| 播放提示音 | 只关声音，通知照常弹 |
| 音量 | 0–100%，试听和正式提示音同时生效 |
| 提示音 | `‹ 当前音效 ›` 左右箭头切换（**切换即试听**），点名字重播；右侧下拉箭头打开全部音效 |
| 全部音效 | 覆盖页列出所有内置音效，每行带独立试听键；下方是**自定义音效**入口 |
| 自定义音效 | 选择本地音频 → 在波形上拖选范围 → 试听这段 → 保存并使用 |

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

## 提示音

插件自带三个音效。其中两个是**从零做加法合成**的 —— 一声干净的钟式「叮」，也就是系统通知音的那种质感 —— 不是从任何产品里抓的采样，所以可以合法随包分发：

| 音效 | 素材 | 说明 |
| --- | --- | --- |
| 冰冰冰 (`bingbingbing`) | `assets/bingbingbing.ogg` | 梗音效，裁成一轮 1.06 秒的三连音，12 642 字节 |
| 清脆提示 (`crisp-a`) | `assets/crisp-a.ogg`，合成 | 两音上行（F#6 → F#7），付款确认那种干脆感，0.50 秒，6 477 字节 |
| 清脆短音 (`crisp-b`) | `assets/crisp-b.ogg`，合成 | 三音上行马林巴（D4 → A4 → D5），短信提示那种，0.58 秒，7 068 字节 |
| 哈气 (`hiss`) | `assets/hiss.ogg`，合成 | 一声短促的「嘶——」：带通噪声、无音高，起音硬、收得快，0.70 秒，11 053 字节 |
| 哎呀我去 (`yikes`) | `assets/yikes.ogg`，合成 | 两音下行短哨（A#4 → D#4），起音带气声，惊讶那一下，0.46 秒，8 457 字节 |

### 怎么加一个音效

`tools/tones.json` 是声明音效的唯一地方：

1. 把 Ogg 放进 `assets/`；
2. 在 `tools/tones.json` 加一行 —— `id`、`label`、`hint`、`source`，以及 `kind`
   （自己合成的写 `synth`，第三方素材写 `recording`，后者的来源必须写进 NOTICE）；
3. `powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-tones.ps1`；
4. 升版本号并刷新窗口。

`lib/client.js` 的音效列表由生成块里的 `TONE_DEFINITIONS` 构建，所以不用改代码；两个漂移检查
（`tools/check-embedded-tone.mjs` 与 PowerShell 的 `-Check`）读的都是这份注册表。


合成脚本是 `tools/synthesize_tones.py`：每个音是"一叠衰减分音 + 起音处一个极短的带限噪声爆发"（后者就是它让铃声"脆"起来的原因），按手放的起音位置叠进轨道，再混音。改写时有两个坑值得记住：

* **敲击音要在 dB 上衰减，不是线性幅度。** 线性的 `exp(-t / tau)` 在前一个 `tau` 内几乎不降，短音听起来就是"从无声渐强"而不是"敲一下"。这里的每个音都按 `10 ** (-3 * t / tau)` 下落，峰值就落在起音上 —— 开发过程中正是这个错误让最后一个音出现了明显的"渐强"，而且渲染包络一看就露馅。
* **马林巴的高次分音比基频衰减更快**，所以 `crisp-b` 的敲击瞬间听感高五度，再落回基频。第 3、5 分音是整叠里最响的。

重新生成：

```bash
python tools/synthesize_tones.py assets            # 生成 WAV 母版
python tools/synthesize_tones.py assets <ffmpeg>   # 再生成插件内嵌用的 Ogg
```

重新内嵌进 bundle 里那段 `//#region embedded-tones` 标记块：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-tones.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-tones.ps1 -Check   # 素材与生成物不一致时失败
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

脚本写入前会逐个校验 `OggS` magic。**必须是 Ogg**：Chromium 的 `decodeAudioData` 不解码 mp3，内嵌 mp3 也没有意义。跨平台等价命令：`node tools/check-embedded-tone.mjs`。

### 自定义音效：就地裁切

设置里有一项**自定义音效**。选中本地文件后会解码、画出波形，并打开裁切对话框：拖动首尾两个把手、试听选中的那一段、保存。只有选中的片段会被编码（16-bit PCM WAV —— 浏览器不借助库能写出的唯一容器）并存入设置文档；建议 3 秒以内，超过约 2 MB 会被直接拒绝而不是悄悄截断。

梗音效的来源与再分发注意事项见 [NOTICE](NOTICE)；两个合成音效没有这个问题，终端用户也随时可以上传自己的。

---

## 目录结构

```
dsh-completion-alert/
├─ package.json             dsh.pluginType=client、dsh.client.inject、bundle patch
├─ cordis.patch.yml         把 completion-alert 行插进 profile
├─ install.ps1              安装（备份、patchReload=live、幂等），-Uninstall 亦可
├─ uninstall-all.ps1        把插件痕迹从 profile 里彻底清掉，不碰别的插件
├─ assets/                  内嵌工具读取的音源
│  ├─ bingbingbing.ogg      梗音效（来源见 NOTICE）
│  ├─ crisp-a.ogg/.wav      合成：两音上行付款提示（F#6 → F#7）
│  └─ crisp-b.ogg/.wav      合成：三音上行短信提示（D4 → A4 → D5）
├─ lib/
│  ├─ index.js              宿主半边：volatile 设置 schema + 诊断路由
│  ├─ client.js             浏览器半边：完成检测 / 播放 / 通知层 / 设置页

├─ tools/
│  ├─ synthesize_tones.py   从零合成清脆音效（numpy）
│  ├─ embed-tones.ps1       把 assets/ 重新嵌进 lib/client.js（-Check 查漂移）
│  ├─ embed-audio.ps1       转发到 embed-tones.ps1 的兼容壳
│  └─ check-embedded-tone.mjs  漂移 + Ogg magic 检查（跨平台，CI 用）
└─ test/
   ├─ host.test.mjs         schema 表面、volatile 标记、诊断路由
   ├─ client.test.mjs       音效库、设置清洗、完成边沿、提示范围、持久化、跳转
   └─ loader.mjs / -hooks   给测试解析 schemastery 这个 peer 依赖
```

## 开发

```bash
npm install          # 拉取宿主半边 import 的 schemastery peer 依赖
npm test             # 45 项测试
node tools/check-embedded-tone.mjs
```

测试是行为测试而不是结构快照：客户端测试把真实 bundle 载入 `vm` 沙箱，配一个 React 桩、生成好的音效模块和伪造的 dsh 客户端上下文，然后直接驱动 store 去断言真正决定行为的那些点 —— 音效库与打包素材逐字节一致、首个快照基线、忙→闲边沿、`仅后台会话` 范围、去抖写入自己的命名空间、经 `uiWorkspace` 跳转、以及通知队列。宿主测试校验 schema 表面（包括 volatile 节点位于固定路径、其内部不再套 volatile —— 这是应用会直接拒绝的形状）和诊断路由的往返。

CI（`.github/workflows/test.yml`）在 Node 24 上跑测试与漂移检查。

## 已知限制

- **自定义音效存成 WAV**。裁切对话框写 16-bit PCM，因为那是浏览器不借助库能编码的唯一容器；3 秒以内可以保证设置文档不会太大。
- **只有内嵌那一条路必须是 Ogg**。自定义上传 mp3/wav/ogg 都能解码（Chromium 解 mp3 没问题），但构建期内嵌的 payload 必须是 Ogg。
- **同时只响一声**。上一声还没放完时来的新完成会替换它，而不是混在一起。
- **不走系统级通知**。通知是 dsh 自己的浮层卡片，因此不需要 Electron 通知权限，Web 与桌面端表现一致。
- **提示音有三个，其中一个是梗素材**。两个清脆音是我自己合成的，没有版权顾虑；「冰冰冰」按 NOTICE 里的说明对待。

## 许可

代码 MIT —— 见 [LICENSE](LICENSE)。内嵌的音频片段是第三方素材，再分发前请读 [NOTICE](NOTICE)。
