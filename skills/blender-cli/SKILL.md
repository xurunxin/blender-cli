---
name: blender-cli
description: 通过 blender-cli 按需查询和编辑 Blender 场景、执行建模脚本，以及安装官方 Blender MCP、启动带桥接的应用和诊断连接。
---

使用终端中的 `blender-cli`。命令运行时启动官方 Blender lab MCP 客户端，结束后关闭；Blender 内的本机桥接与应用独立存活。

先运行 `doctor`；环境缺失时检查 `setup --help`，运行 `setup` 安装 CLI 管理的 MCP 和插件。用 `app launch` 启动带桥接的 Blender；该启动流程只启用本次应用会话的插件。已有 Blender 的普通启动进程可能没有桥接，先读取诊断结果再决定启动方式，保留已有场景。

操作前 `tools list`，再 `tools inspect <name>` 查看当前 schema。官方项目与其他同名 Blender MCP 的工具和协议不同，依据实时工具清单选择。通过 `tools call <name> --args-file <json-file>` 传 UTF-8 JSON 对象，或用 `--stdin`；`call` 是简写。相关操作可用 `batch <json-file>`，格式 `[{"tool":"名称","args":{}}]`。

先查询场景、对象、材质与文件路径，再按用户要求执行改动。执行代码前检查当前版本 API，需要时调用上游文档工具。以对象状态、输出文件或渲染结果验收，MCP 握手不代表场景操作成功。

stdout 为 JSON；`ok:false` 或非零退出码表示失败，上游内容块保留在 `result`。超时/中断时已提交的操作可能仍执行，先检查场景状态再考虑重试。batch 失败返回已完成项，保留该进度。

`skills install --target <project>` 给另一个项目安装此 skill，Claude 项目用 `--agent claude`。用户要移除固定接入时用 `integration disable-codex --dry-run` 查看条目，再执行实际迁移；备份保留，重启 Codex 生效。
