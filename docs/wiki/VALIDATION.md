# Wiki validation — 2026-09-16

本记录仅涉及本次 Wiki 变更，不替换仓库原有 `docs/validation.md` 的历史实机验收。

## 本次实际执行

环境：Linux，Node.js v22.16.0，npm 10.9.2。工作目录是从已读取的仓库文件重建的变更工作副本，不是完整克隆；没有安装项目锁定的 Commander 15.0.0 或 MCP SDK，也没有 Blender。

- `node --test tests/wiki.test.mjs`：**61/61 通过，0 失败，0 跳过**。覆盖语料结构、来源及关联 ID、中英检索、16 个排错首位命中用例、排序稳定性、分类分页、完整 JSON 字符预算、退出码、路径输入拒绝、损坏语料防护，以及异地工作目录/零配置写入。
- `node src/wiki-cli.mjs validate`：通过；45 个条目（18 topic、21 recipe、6 workflow），29 条来源。
- 实际运行独立入口的布料穿透检索、游戏资产步骤读取：结果 ID、步骤与来源符合预期。
- `node --check src/cli.mjs`、`src/wiki.mjs`、`src/wiki-cli.mjs`：通过。
- 上传正文与本地已测试正文的 Git blob SHA 一致：`8798bc228593511f8f01f9b17e8332f94ea25b4a`。主 CLI 工作副本的 SHA 为 `9f5466af52bcb28ea90b28f08ec880105ef05c6d`，与本次集成文件一致。

第一次测试时仅主 CLI 静态检查因工作副本缺少 `src/cli.mjs` 而失败；补齐真实集成文件后重跑全部 61 项通过，未通过伪造 stub 或跳过测试绕开检查。

以上主 CLI 检查是语法和注册代码静态检查，**不是完整 CLI 在锁定依赖下运行的证明**。

## 尚未在本地执行

没有执行完整 `npm ci`、原有 MCP/session/应用生命周期回归、打包查询脚本或项目锁定 Commander 15.0.0 下的主 CLI 实跑。没有 Windows/macOS 实机、Blender 场景、渲染、导出或模拟验收。`inspect_scene.py` 是只读探测示例，不声称已在 Blender 中运行。

已提交 Windows/Linux、Node 22 的 GitHub Actions 配置，覆盖锁定依赖安装、完整测试、语法检查、原生 `wiki search` 零配置写入及实际 npm pack/解包查询。**配置存在不等于 CI 已通过**，以 PR 的实际 Checks 结果为准。打包检查采用 Node 独立 Wiki 入口；完整主 CLI 由前面的原生命令单独检查。

## 内容与来源边界

来源共 19 条官方、9 条原作者社区文章/原始讨论及 1 条固定提交仓库文件。注册表逐条记录版本范围、复核日期、阅读深度与限制；部分官方网页只能取得检索正文摘录，不能称为全文复核。滚动链接不是不可变快照。

正文是按任务整理的原创操作和验收建议，不是文档整站复制。技术候选必须先核对现场版本和实时工具 schema。所有条目保持 `coverage: curated-not-runtime-tested`、`runtime_tested: false`；Node 测试通过不改变 Blender 运行证据等级。

## 合并前与现场验收

合并前检查 PR 的 Windows/Linux 回归、原生命令和打包步骤。现场先执行纯 Wiki 查询，确认不启动 Blender、不写 CLI 配置，再在获授权的测试项目安装或更新 Skill。

Blender 小样建议覆盖材质/烘焙、少量实例散布、布料或 GN 模拟、Action/Slot 动画、目标端重新加载 glTF。每项保留版本、输入检查点、实际步骤、输出文件和验收图像；完成之前不得提高条目覆盖等级。
