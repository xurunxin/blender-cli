# blender-cli

以目标任务管理 blender-cli 的应用和 MCP 生命周期。任务内复用同一应用和 MCP 进程，按目标完成、资源占用和用户后续使用决定保留或关闭。

## Agent Wiki（离线知识检索）

```powershell
blender-cli wiki search "布料穿透" --kind recipe --limit 3
blender-cli wiki search "几何节点散布" --max-chars 6000
blender-cli wiki show workflow-game-asset --section steps
blender-cli wiki sources S-GLTF
blender-cli wiki status
```

45 个原创归纳条目（18 个主题、21 个排错配方、6 条工作流），关联 29 条官方、社区原作者及仓库来源。只读随包 Markdown；不启动 Blender/MCP、不读取用户配置，不需要 API key、向量库或 Python。先 Wiki 规划，再现场 `tools list/inspect`，最后检查场景与产物。

[Wiki 首页与命令参考](docs/wiki/README.md) · [可直接阅读的知识手册](docs/wiki/guide.md) · [来源与复核深度](docs/wiki/sources.json) · [本次验收边界](docs/wiki/VALIDATION.md)。

原生入口需要正常安装 CLI 的 Node 依赖；完全无依赖的查询入口为 `node src/wiki-cli.mjs search "布料穿透"`。安装后的原有 `blender-cli` Skill 已增加 Wiki 路由；已有定制 Skill 仍受覆盖保护，不会自动替换。知识步骤未在 Blender 实机验收，不能将检索命中作为执行成功证据。

## 推荐任务流程（v0.2）

```powershell
blender-cli session start shot-01 --launch-app
blender-cli --session shot-01 tools list
blender-cli --session shot-01 tools inspect <工具名>
blender-cli --session shot-01 tools call <工具名> --args-file args.json
blender-cli session status shot-01
# 目标完成：释放 MCP，应用继续保留
blender-cli session end shot-01
# 确认本任务启动的应用无未保存工作且不再需要时
# blender-cli session end shot-01 --close-app
```

`--launch-app` 优先复用已有应用，只在没有对应应用时启动并记录进程归属。同名 start 幂等复用会话；一个 CLI 状态目录同时服务一个目标任务，其他目标会返回冲突。任务期间工具命令加 `--session`；已有会话时，省略该参数会失败，避免另开 MCP 抢占应用桥接。

`session end` 默认只关闭 MCP。`--close-app` 仅正常关闭本任务启动、PID/路径/创建时间仍匹配的 Windows GUI；原生保存提示不会被绕过。复用的应用、身份不明的进程、后台应用及不支持的平台均保留，并返回原因。Agent 应先检查未保存内容、后台渲染/cook 和后续用途，再决定关闭时机。应用桥接随应用保留。

会话仅在任务请求下创建，通过本机带随机凭据的通道供 CLI 调用，不注册为固定 Codex MCP。默认空闲 1800 秒回收 MCP，`session start --idle-timeout <seconds>` 可调整（1..86400）；进行中的请求不触发空闲回收。空闲回收、异常和中断均保留应用。超时后不自动重启/重试，先检查实际操作结果。

无任务会话时仍支持一次性 `tools/call/batch`；它们只在该次命令期间运行 MCP。下面的单次示例也可在命令前加入 `--session <task>`，在任务内复用连接。

## 安装和初始化

需要 Node.js 22+、uv、Git 和符合官方 MCP 扩展要求的 Blender。私有仓库需要有权限的 GitHub 账号：

```powershell
gh repo clone xurunxin/blender-cli
cd blender-cli
npm ci
npm install --global .
blender-cli doctor
blender-cli setup --dry-run
blender-cli setup --timeout 180000
blender-cli app launch
blender-cli doctor --connect
blender-cli tools list
```

也可以用 `npm install --global git+ssh://git@github.com/xurunxin/blender-cli.git`（需 GitHub SSH 权限）。不需要 npm registry 包。

Windows 新环境可执行 `pwsh -NoProfile -File scripts/install.ps1 -InstallPrerequisites`，通过 winget 补齐 Node.js、uv，再安装 CLI 并 setup。若系统缺 Git，请先安装 Git；Blender 从[官方网站](https://www.blender.org/download/)安装。已有依赖时去掉 `-InstallPrerequisites`。`-SkipSetup` 仅安装 CLI，`-Project <path>` 同时安装项目 skill。

setup 安装固定版本的官方源码、隔离 Python/MCP 依赖和应用扩展。自定义安装目录用 `--app-path`，离线或现成源码用 `--source`。已有插件与用户偏好按冲突保护规则保留；详细的上游版本、启动方式与离线限制见 [Blender 初始化](docs/blender-setup.md)。

`app launch` 打开带桥接的 Blender；`app launch --headless` 使用后台模式。普通启动的 Blender 可能尚未启用桥接。端口默认 9876，仅允许本机 loopback，`setup --port <n>` 持久化变更。已有端口被占用时先确认归属，CLI 不关闭其他应用进程。

## 动态工具调用

```powershell
blender-cli tools list
blender-cli tools inspect <工具名>
blender-cli tools call <工具名> --args-file args.json
```

工具名称、说明和输入 schema 每次从当前 MCP 实时发现。`tools list --full` 输出完整 schema；`call <工具名>` 是简写。参数支持 `--args '<JSON>'`、`--args-file` 或 `--stdin`，三选一；PowerShell 推荐 UTF-8 JSON 文件。

`batch calls.json` 顺序执行 `[{"tool":"名称","args":{}}]`，共享一个短暂会话，首次错误立即停止并返回已完成项。`resources list/read` 访问上游资源（仅在上游支持时）。

JSON stdout 提供 `{ok:true,...}` 或 `{ok:false,error:{code,message,details}}`；`--verbose` 将上游日志写入 stderr。退出码 `0` 成功，`1` 环境/运行/工具错误，`2` 参数错误。`TOOL_ERROR` 保留原始 MCP 内容。一次性模式默认整个 MCP 会话 60 秒超时，任务模式按每个请求计算，用 `--timeout 180000` 调整；不自动重试已提交的应用操作，超时后先检查场景结果。

## 项目 skills

在目标项目运行，或指定已有目录：

```powershell
blender-cli skills install
blender-cli skills install --target "D:\MyProject"
blender-cli skills install --target "D:\MyProject" --agent all --dry-run
```

默认安装到 `.agents/skills/blender-cli/SKILL.md`；`--agent claude` 安装到 `.claude/skills`，`all` 安装两处。保护定制 skill，只有 `--force` 才覆盖同名文件；保留无关文件并拒绝 symlink/junction 逃逸。

## 固定 MCP 迁移

CLI 实际调用成功后执行 `blender-cli integration disable-codex --dry-run` 查看匹配条目，再运行 `blender-cli integration disable-codex`。它仅禁用 Codex 的 `blender` 固定 MCP 表，保存原配置旁的唯一备份，保留其他服务。重启 Codex 生效。恢复时将对应表的 `enabled` 改回 `true`。

CLI setup 与 Codex 配置迁移是两个独立操作。CLI 状态默认保存到用户本地数据目录 `blender-cli`，支持 `--home <directory>` 或 `BLENDER_CLI_HOME` 隔离环境；`config` 查看实际路径。

## 开发和验收

```powershell
npm ci
npm test
npm run check
npm pack --dry-run
```

测试包含 stdio 生命周期、分页、工具错误、超时、技能安装保护与精确配置迁移，应用适配另有针对性测试。实际应用结果见 [验收记录](docs/validation.md)。主要验收平台是 Windows；macOS/Linux 探测路径未完成目标平台应用验收。

上游为 [Blender lab blender_mcp](https://projects.blender.org/lab/blender_mcp)，并非其他同名社区 MCP。客户端使用 [官方 MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x)。第三方信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
