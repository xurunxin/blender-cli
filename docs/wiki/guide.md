# Blender Agent 知识手册

2026-09-16 · 18 个主题 / 21 个排错配方 / 6 条工作流。

这是原创归纳的任务知识层，不是官方手册镜像或可盲跑脚本。每条的来源 ID 可用 `blender-cli wiki sources <ID>` 查看；[来源注册表](sources.json) 记录版本与复核深度。官方定义、社区诊断候选与本库设计的操作/验收建议需要区别使用。所有条目目前均未在 Blender 实机验收。

先用 `wiki search` 缩小范围，再用 `wiki show <id> --section steps` 按需阅读；实际工具名和参数始终通过现场 `tools list/inspect` 获取。

## 目录

**功能主题**

- [Agent：从问题检索到产物验收](#topic-agent)
- [Python：数据 API、操作符与上下文](#topic-python)
- [BMesh：网格拓扑编辑与所有权](#topic-bmesh)
- [非破坏建模：修改器顺序与倒角](#topic-modifiers)
- [UV：接缝、展开与纹素密度](#topic-uv)
- [材质：PBR 贴图与节点连接](#topic-materials)
- [纹理烘焙：目标图像与高低模投射](#topic-baking)
- [几何节点：Field、Domain 与求值上下文](#topic-fields)
- [实例散布：方向、随机性与实体化](#topic-instances)
- [模拟：状态、顺序求值与缓存](#topic-simulation)
- [渲染：预检、采样与质量小样](#topic-rendering)
- [颜色管理：数据纹理、显示变换与 EXR](#topic-color)
- [动画：数据目标、Action 与 Slot](#topic-animation)
- [布料：初始条件、碰撞与小样](#topic-cloth)
- [glTF：资产兼容性与目标端往返](#topic-gltf)
- [后台批处理：参数顺序与文件隔离](#topic-headless)
- [Houdini 到 Blender：概念映射而非命令翻译](#topic-houdini)
- [版本核查：旧教程、节点与 API 迁移](#topic-versions)

**排错配方**

- [排错：operator poll failed / 上下文不匹配](#recipe-context)
- [排错：贴图丢失、粉色或资源搬家](#recipe-missing-texture)
- [排错：法线贴图凹凸反向或接缝](#recipe-normal-map)
- [排错：几何法线、黑面和意外破面](#recipe-mesh-normals)
- [排错：倒角不均匀、消失或夹面](#recipe-bevel)
- [排错：UV 拉伸与纹素密度不均](#recipe-uv-stretch)
- [排错：No active image / 烘焙目标不明确](#recipe-bake-target)
- [排错：烘焙全黑、空白或投射错误](#recipe-bake-black)
- [排错：field domain 错误、属性全零](#recipe-field-domain)
- [排错：散布方向错误或植物横躺](#recipe-scatter-direction)
- [排错：实体化实例后内存暴涨](#recipe-realize-memory)
- [排错：模拟跳帧、缓存失效或重开不同](#recipe-simulation-cache)
- [排错：渲染黑帧、空画面或错镜头](#recipe-black-render)
- [排错：渲染噪点、降噪涂抹和闪烁](#recipe-noise)
- [排错：EXR 太暗、交接偏色或过度对比](#recipe-color-mismatch)
- [排错：有关键帧但对象不动](#recipe-animation-still)
- [排错：布料穿透、爆炸与自挤压](#recipe-cloth-penetration)
- [排错：glTF 丢材质或网页表现不同](#recipe-gltf-material)
- [排错：导出比例、朝向或镜像错误](#recipe-export-scale)
- [排错：序列缺帧、错帧和输出覆盖](#recipe-frame-range)
- [排错：工具超时、断线与安全恢复](#recipe-timeout)

**完整工作流**

- [工作流：产品静帧，从需求到交付](#workflow-product-shot)
- [工作流：游戏/网页资产到 glTF 验收](#workflow-game-asset)
- [工作流：程序化散布与可控变化](#workflow-scatter)
- [工作流：布料镜头的试算、缓存与交付](#workflow-cloth)
- [工作流：动画镜头到图像序列交接](#workflow-animation)
- [工作流：Agent 批量任务与证据清单](#workflow-automation)

<!-- wiki {"id":"topic-agent","kind":"topic","aliases":["agent入门","快速上手","MCP","任务规划","workflow routing"],"sources":["S-CLI"],"related":["topic-python","recipe-timeout","workflow-automation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-agent"></a>
## Agent：从问题检索到产物验收

来源：[S-CLI](sources.json)

### 目标
先确定要学什么、改什么和怎样判定成功，再使用现场真实工具。Wiki 查询本身不接触用户场景。

### 前置检查
- 区分纯咨询和实际编辑授权；明确目标对象、交付格式与输出目录。
- 保留原场景，记录用户已有任务与应用归属。

### 步骤
- 先执行 `blender-cli wiki search "任务或症状" --limit 3`，再按命中 ID 用 `wiki show` 阅读步骤与验收。
- 只读学习无需 setup；要编辑时用 `session status` 检查占用，再建立自己的目标任务会话。
- 在任务内运行 `--session <task> tools list` 和 `tools inspect <实际名称>`；依据实际 schema 创建 UTF-8 参数文件。
- 先只读查询版本、对象和文件，再做最小可逆改动；记录调用结果、检查点与输出证据。
- 验收场景和实际产物；需要释放时 `session end <task>` 默认保留应用。

### 排错
- 工具名字相似不意味着属于本项目的上游实现。
- 握手成功或 `ok:true` 不能替代场景、渲染或导出验收。

### 验收
- 报告包含目标、实际改动、输出路径、检查结果及未验证部分。
- 没有结束他人会话、覆盖未授权文件或重放超时操作。

### 版本提示
CLI 契约依据固定提交 S-CLI；本次 Wiki 新增命令见 Wiki README。知识来源与运行证据分开记录。

<!-- wiki {"id":"topic-python","kind":"topic","aliases":["bpy","Python脚本","数据API","operator","context","后台脚本"],"sources":["S-OPERATORS","S-SURF","S-DUCK"],"related":["recipe-context","topic-bmesh"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-python"></a>
## Python：数据 API、操作符与上下文

来源：[S-OPERATORS](sources.json)、[S-SURF](sources.json)、[S-DUCK](sources.json)

### 目标
把一个界面动作转换成对明确数据块的受控操作，减少对当前选择和编辑器焦点的隐式依赖。

### 前置检查
- 读取 `bpy.app.version_string`、`bpy.context.mode`、活动对象、选择集合和当前文件。
- 确认修改的是 Object、Mesh、Material 还是节点树，以及数据块是否被多个对象共享。

### 步骤
- 先按名称或已核实的标识解析目标，例如 `bpy.data.objects.get(name)`；目标缺失即停止，不以第一个对象代替。
- 属性变更优先显式数据 API；网格拓扑评估 BMesh；确需操作符时检查其文档和 `poll()`。
- 需要上下文时只使用真实存在且匹配的场景、模式和编辑器；核对当前版本的 `temp_override`，不伪造后台窗口。
- 每段脚本只做一个可验收的变更，输出修改前后关键字段，并恢复本任务临时改变的选择或模式。

### 排错
- 旧文章中的 unlink、场景对象集合等写法不能直接复制到新版本。
- 系统 Python 通常没有当前 Blender 的 bpy；不要把离线语法通过当作 Blender 执行通过。

### 验收
- 目标数据改变且无关对象保持原状。
- 遇到不满足的上下文或 API 时明确失败，而不是隐藏异常继续执行。

### 版本提示
S-DUCK 是旧版设计思路来源；具体 API 以现场 Blender 的官方文档为准。

<!-- wiki {"id":"topic-bmesh","kind":"topic","aliases":["bmesh","网格编辑","拓扑","edit mesh"],"sources":["S-BMESH","S-OPERATORS"],"related":["topic-python","recipe-mesh-normals"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-bmesh"></a>
## BMesh：网格拓扑编辑与所有权

来源：[S-BMESH](sources.json)、[S-OPERATORS](sources.json)

### 目标
在明确对象模式和数据所有权的前提下读取或编辑顶点、边、面。

### 前置检查
- 确认对象类型为 MESH，检查共享网格、形态键与修改器依赖。
- 先记下顶点、边、面数量和允许变化范围。

### 步骤
- 对象模式下评估独立 BMesh 的 `new/from_mesh/to_mesh/free` 生命周期；写回前保留可恢复副本。
- 编辑模式下使用当前版本文档中的 `from_edit_mesh/update_edit_mesh` 路线；不要对 Blender 持有的编辑 BMesh 调用 free。
- 按条件构造明确的元素集合，查询所需 `bmesh.ops` 的当前签名；不要依赖拓扑修改前的整数索引仍有效。
- 写回或更新后检查元素数、退化面、法线与视图结果；仅在检查完成后保存交付副本。

### 排错
- 对象数据与编辑模式中的活动网格可能不是同一更新入口。
- 共享 Mesh 的写入可能影响其他对象，必要时先在授权范围内复制数据。

### 验收
- 网格计数与计划相符，无非预期空网格或大面积退化面。
- 修改前后目标轮廓、UV和材质索引按任务要求保留。

### 版本提示
函数名是查询入口，不是免校验的完整脚本；BMesh 返回字段和参数应匹配现场版本。

<!-- wiki {"id":"topic-modifiers","kind":"topic","aliases":["修改器","modifier stack","倒角","bevel","布尔","硬表面"],"sources":["S-BEVEL","S-SURF"],"related":["recipe-bevel","workflow-product-shot"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-modifiers"></a>
## 非破坏建模：修改器顺序与倒角

来源：[S-BEVEL](sources.json)、[S-SURF](sources.json)

### 目标
用可回退的修改器组合表达建模意图，先看小样再决定是否应用到网格。

### 前置检查
- 检查对象尺寸、缩放、网格密度、已有修改器及视图/渲染启用状态。
- 确认布尔操作数、共享数据和模型最终用途。

### 步骤
- 先复制测试对象或保存检查点；按意图列出布尔、倒角、细分等候选，而不是套固定全局顺序。
- 对倒角先用小宽度和少量段数验证边界；逐步核对限制方式与重叠行为。
- 每次只调整一个修改器或其位置，比较轮廓、接缝、高光与面数。
- 只在导出或后续编辑确有需要时，在交付副本上应用修改器；保留可编辑源模型。

### 排错
- 未核对缩放就应用变换，可能改变绑定、动画或其他依赖。
- 提高细分等级无法修复布尔自交或错误拓扑。

### 验收
- 关键视角无明显自交、破面或超出设计的轮廓变化。
- 源模型保留参数化结构，交付副本满足面数和导出限制。

### 版本提示
倒角选项、平滑流程和修改器 API 可能随版本变化；不要固定旧版菜单路径。

<!-- wiki {"id":"topic-uv","kind":"topic","aliases":["UV展开","unwrap","seam","纹素密度","UV mapping"],"sources":["S-UV","S-BAKE"],"related":["recipe-uv-stretch","workflow-game-asset"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-uv"></a>
## UV：接缝、展开与纹素密度

来源：[S-UV](sources.json)、[S-BAKE](sources.json)

### 目标
把表面映射到纹理空间，并用可视检查而不是“已有 UV 层”作为完成标准。

### 前置检查
- 确定贴图尺寸、是否允许重叠、是否使用 UDIM，以及哪些区域需要更高精度。
- 检查几何尺度、拓扑和已有 UV 层，保留必要的旧布局。

### 步骤
- 按隐藏面、硬边与可展开曲面规划接缝，先展开一个代表性区域。
- 给模型使用棋盘测试纹理，检查拉伸和缝边；根据问题增加接缝或调整岛屿。
- 按目标纹素密度分配面积并打包；为最终分辨率与过滤留边距。
- 确认材质使用的 UV 层与导出器选用的一致，再检查完整模型。

### 排错
- 盲目禁止所有重叠会破坏有意的镜像复用。
- 低清视图看不到的接缝可能在近景或 mipmap 下出现。

### 验收
- 棋盘大小与形状在关注区域基本一致。
- 无非预期重叠、越界或过小岛屿，近景接缝符合项目要求。

### 版本提示
展开/打包算法与操作符上下文需现场核验；本文不假定必须存在某个 GUI 编辑器。

<!-- wiki {"id":"topic-materials","kind":"topic","aliases":["PBR","Principled BSDF","材质","roughness","metallic","贴图"],"sources":["S-PBR","S-COLOR","S-SCAN"],"related":["recipe-missing-texture","recipe-normal-map","topic-gltf"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-materials"></a>
## 材质：PBR 贴图与节点连接

来源：[S-PBR](sources.json)、[S-COLOR](sources.json)、[S-SCAN](sources.json)

### 目标
建立可理解、可移交的材质网络，明确每张图是颜色信息还是数据。

### 前置检查
- 核对贴图语义、颜色空间、实际文件、UV 和目标渲染器。
- 确认材质赋给正确对象与面，而不是只创建未被使用的材质数据块。

### 步骤
- 从一个简单 Principled BSDF 材质开始，先验证 Base Color 与材质输出。
- 逐张接入粗糙度、金属度等数据图并按语义设置 Non-Color；颜色贴图使用其真实输入色彩空间。
- 法线图经过匹配空间的 Normal Map 节点连接法线输入；高度图与法线图分开处理。
- 在统一光照下检查粗糙度、反射与尺度，记录节点名、贴图路径和必要的来源归属。

### 排错
- 不同供应商的通道打包方式可能不同，不能看到 RGB 图就当作 Base Color。
- 不要把所有图一律当 sRGB，也不要按固定数字下标寻找 Principled 输入。

### 验收
- 目标对象正确显示材质，无丢图或错误面分配。
- 材质在指定渲染器中可复现，并明确不能直接导出的程序化部分。

### 版本提示
Principled 的实现、插槽和支持参数随版本演进；读取当前节点输入名称或 RNA 后再写值。

<!-- wiki {"id":"topic-baking","kind":"topic","aliases":["bake","烘焙","高低模","normal bake","selected to active"],"sources":["S-BAKE","S-BAKE-CASE","S-SCAN"],"related":["recipe-bake-target","recipe-bake-black"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-baking"></a>
## 纹理烘焙：目标图像与高低模投射

来源：[S-BAKE](sources.json)、[S-BAKE-CASE](sources.json)、[S-SCAN](sources.json)

### 目标
把指定表面信息写入明确的目标贴图，避免把源纹理当成烘焙画布。

### 前置检查
- 确认使用支持该烘焙路径的引擎、低模 UV、源/目标对象与输出权限。
- 为每个需要写入的材质准备独立目标图像，保留源贴图。

### 步骤
- 列出要烘焙的通道及用途；Base Color、法线和含光照的结果不得混称。
- 逐一核对目标材质中活动且选中的 Image Texture 节点以及关联 Image 数据块。
- 高低模投射时确认活动低模、源几何、距离或 cage；先低分辨率测试一块代表性区域。
- 检查结果后按唯一文件名保存图像，再在目标材质重新载入验证。

### 排错
- 保存 blend 不应被当作所有外部烘焙图像已保存的证据。
- 社区旧版本出现过活动图像歧义；即使操作返回成功也要检查实际写入目标。

### 验收
- 指定图像包含预期内容且源贴图未被覆盖。
- 低模加载烘焙结果后接缝、投射与通道语义符合用途。

### 版本提示
烘焙可用目标、模式与选中要求以当前手册为准；不直接套用旧社区帖子中的默认行为。

<!-- wiki {"id":"topic-fields","kind":"topic","aliases":["几何节点","Geometry Nodes","field","domain","属性","场"],"sources":["S-FIELDS","S-ATTR","S-CGWIKI","S-FIELD-CASE"],"related":["recipe-field-domain","topic-instances","topic-houdini"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-fields"></a>
## 几何节点：Field、Domain 与求值上下文

来源：[S-FIELDS](sources.json)、[S-ATTR](sources.json)、[S-CGWIKI](sources.json)、[S-FIELD-CASE](sources.json)

### 目标
理解数据在哪份几何、哪个元素域上求值，再构建可解释的节点网络。

### 前置检查
- 区分几何连线和场表达式；列出点、边、面、面角或实例等需要的域。
- 确定源几何与目标几何，检查属性名称和类型。

### 步骤
- 从一个小网格和 Group Input/Output 建最小图，先只验证几何流是否连通。
- 把 Position 等场连接到实际消费它的节点，明确该节点使用哪份几何作为求值上下文。
- 跨几何读取时选合适的采样方式；用 Viewer/Spreadsheet 检查几组数值，不凭连线颜色判断正确。
- 需要持久保留值时明确捕获或存储位置、类型和域，再接入后续拓扑修改。

### 排错
- 把 Position 当作已固定的一组坐标会忽略消费节点的上下文。
- 实例域的值与实体网格点域的值不能无条件混用。

### 验收
- 小样中被修改的元素和数值与手算/预期一致。
- 改变源几何或拓扑后，属性和求值路径仍能解释且无意外全零。

### 版本提示
旧 GN 教程中的属性节点和插槽可能已迁移；按现场节点清单与当前文档检查。

<!-- wiki {"id":"topic-instances","kind":"topic","aliases":["实例","instance on points","scatter","几何节点散布","Realize Instances"],"sources":["S-INSTANCES","S-CGWIKI"],"related":["recipe-scatter-direction","recipe-realize-memory","workflow-scatter"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-instances"></a>
## 实例散布：方向、随机性与实体化

来源：[S-INSTANCES](sources.json)、[S-CGWIKI](sources.json)

### 目标
把少量源资产复用到点上，并控制密度、朝向和成本。

### 前置检查
- 确定散布表面、源对象局部轴、原点、缩放和可接受实例数量。
- 指定随机种子及需要稳定复现的条件。

### 步骤
- 用少量点测试 Distribute Points on Faces 与 Instance on Points 的候选链路。
- 先验证一处法线方向和源资产朝向，再增加旋转、尺度与密度变化。
- 把需要跨帧稳定的随机性与拓扑变化分开检查；记录 seed 与输入版本。
- 仅当下游几何编辑或交付确需独立网格时实体化，并先测小样内存。

### 排错
- 实体化可能显著放大几何数量和内存，不能作为每张图的默认收尾。
- 改变点索引或输入拓扑后，仅保持 seed 不一定保证逐实例对应关系。

### 验收
- 同一输入条件下结果可复现，边界、法线方向和尺度正确。
- 达到目标密度时资源消耗可接受，必要的实体化有明确原因。

### 版本提示
节点插槽、旋转数据类型和实例导出支持须按当前版本核查。

<!-- wiki {"id":"topic-simulation","kind":"topic","aliases":["simulation zone","模拟区域","缓存","bake simulation","时序"],"sources":["S-SIM","S-SIM-BAKE","S-CGWIKI"],"related":["recipe-simulation-cache","topic-cloth"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-simulation"></a>
## 模拟：状态、顺序求值与缓存

来源：[S-SIM](sources.json)、[S-SIM-BAKE](sources.json)、[S-CGWIKI](sources.json)

### 目标
区分无状态逐帧计算与需要上一时刻状态的模拟，建立可复现的缓存交付。

### 前置检查
- 确认起止帧、帧率、初始状态、驱动动画、缓存位置和场景检查点。
- 记录待模拟对象和修改器，不能误清理其他任务缓存。

### 步骤
- 先用很短帧段建立模拟输入、状态传递和输出，检查每一帧是否符合规则。
- 按时间步处理随时间变化的量，不把“每帧常数”未经核验当作“每秒速度”。
- 保存测试场景，在确认的对象和目录上烘焙；记录输入版本与缓存对应关系。
- 重开副本并尝试首、中、尾及非顺序帧，确认读取缓存而不是依赖上次播放残留。

### 排错
- 随机跳到远处帧后看到异常，不应立即修改物理参数。
- 修改初始条件后旧缓存可能失效；不能把缓存存在当作缓存正确。

### 验收
- 相同输入、时间设置与缓存得到一致结果。
- 交付场景及必要缓存可重新打开，随机抽帧无状态丢失。

### 版本提示
不同物理系统的烘焙入口和缓存打包方式不统一；查具体系统手册，不混用布料与 GN 的菜单。

<!-- wiki {"id":"topic-rendering","kind":"topic","aliases":["渲染","Cycles","Eevee","sampling","降噪","render"],"sources":["S-SAMPLE","S-CMD"],"related":["recipe-black-render","recipe-noise","workflow-product-shot"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-rendering"></a>
## 渲染：预检、采样与质量小样

来源：[S-SAMPLE](sources.json)、[S-CMD](sources.json)

### 目标
先证明镜头、灯光和产物设置正确，再增加计算量。

### 前置检查
- 确定相机、渲染引擎、分辨率、帧号/帧段、输出格式和可写目录。
- 检查实际使用的场景、视图层、对象渲染可见性与依赖资源。

### 步骤
- 读取并记录当前渲染设置，先用低分辨率小样检查构图和内容。
- 在困难区域比较采样与降噪结果，观察细节损失而不只看噪声减少。
- 确认输出颜色管理、透明度与分辨率比例，再执行正式渲染。
- 检查实际文件能否解码、尺寸与通道是否正确，并保存预览证据。

### 排错
- 材质预览使用的照明不一定与最终场景照明一致。
- 提高样本数无法修复相机错误、隐藏对象或错误合成输出。

### 验收
- 正式文件可读且镜头内容、尺寸、帧号和格式符合约定。
- 重点区域没有不可接受的噪点、涂抹或时序闪烁。

### 版本提示
引擎标识、采样和降噪选项需从当前环境查询；不假定旧 Eevee 标识或 GPU 后端一定存在。

<!-- wiki {"id":"topic-color","kind":"topic","aliases":["色彩管理","AgX","OCIO","EXR","线性","color management"],"sources":["S-COLOR","S-AGX"],"related":["recipe-color-mismatch","topic-materials","workflow-animation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-color"></a>
## 颜色管理：数据纹理、显示变换与 EXR

来源：[S-COLOR](sources.json)、[S-AGX](sources.json)

### 目标
建立从纹理输入到渲染、显示和后期交接的明确颜色路径。

### 前置检查
- 记录 Blender/OCIO 配置、渲染工作空间、View Transform、Look、曝光及显示设备。
- 确定交付的是显示用图片还是保留场景线性信息的后期中间文件。

### 步骤
- 按图像语义区分颜色贴图与法线/粗糙度等数据图，避免错误输入转换。
- 用同一张测试渲染比较 Blender 视图和交付链路，保留灰阶与高光参考。
- 交接 EXR 时写明其实际颜色空间与通道，不让接收端仅凭扩展名猜测。
- 在目标软件应用匹配的输入解释和显示变换，排查漏转换或重复转换。

### 排错
- 对线性中间文件直接与显示编码截图比较，会把解释差异误认为渲染错误。
- 为“看起来一样”随意改 gamma，可能破坏后期可用性。

### 验收
- 在匹配颜色链路下，关键色块、高光和灰阶与批准参考一致。
- 交付记录包含输入/输出颜色空间及视图设置，数据贴图未错误转换。

### 版本提示
S-COLOR 固定旧版文档只支持颜色/数据分类原则；具体新版本配置和视图名称以现场为准。

<!-- wiki {"id":"topic-animation","kind":"topic","aliases":["动画","关键帧","Action","Slot","F-Curve","NLA"],"sources":["S-ACTIONS","S-SLOTS"],"related":["recipe-animation-still","workflow-animation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-animation"></a>
## 动画：数据目标、Action 与 Slot

来源：[S-ACTIONS](sources.json)、[S-SLOTS](sources.json)

### 目标
把动画关联到正确数据块与动作插槽，检查时间轴上的实际变化。

### 前置检查
- 明确目标是对象变换、骨骼、形态键还是材质节点树。
- 检查现有 Action、Slot、NLA、约束和驱动，保留用户已有动画。

### 步骤
- 先在副本上给一个可观测属性设置两个不同时间的值并插入关键帧。
- 确认关键帧落在正确数据目标及 Action/Slot，不仅检查有没有创建 Action。
- 逐帧查询或预览目标值，检查插值、时间映射与约束覆盖。
- 扩大到完整动作后检查首尾、关键姿态和衔接，再验证导出或渲染结果。

### 排错
- 材质本体与其节点树可能是不同动画目标。
- 旧脚本直接访问旧式 action.fcurves 的假设可能不适用新版动作结构。

### 验收
- 预定时间点的目标值/姿态符合设计，非目标属性不被意外修改。
- 保存并重开后动作关联仍存在；目标端能播放需要的动作。

### 版本提示
4.4 引入 Slotted Actions；跨版本保存与脚本迁移需核查 S-SLOTS，不能只判断文件能否打开。

<!-- wiki {"id":"topic-cloth","kind":"topic","aliases":["cloth","布料模拟","collision","自碰撞","pin group"],"sources":["S-CLOTH","S-CLOTH-CASE"],"related":["recipe-cloth-penetration","workflow-cloth"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-cloth"></a>
## 布料：初始条件、碰撞与小样

来源：[S-CLOTH](sources.json)、[S-CLOTH-CASE](sources.json)

### 目标
先获得稳定的低成本布料运动，再追加表面细节。

### 前置检查
- 检查尺寸、网格密度、缩放、固定区域、碰撞体以及起始帧间距。
- 确认模拟帧段与可用的恢复检查点。

### 步骤
- 选简化布片和碰撞体建立短段测试，先只验证重力、固定区域和运动范围。
- 核对布料及碰撞体的碰撞设置，检查初始面之间的间距是否足以容纳碰撞厚度。
- 有穿透时先检查空间尺度与快速运动，再逐项测试碰撞质量或时间分辨率。
- 运动稳定后再测试细分/厚度修改器的顺序，烘焙并重开抽帧验收。

### 排错
- 照搬别的场景的碰撞距离可能导致悬浮或自挤压。
- 把网格一味加密会增加成本，不能替代正确的初始条件。

### 验收
- 关键接触帧无明显穿透、爆炸或不合理漂浮。
- 固定区域、运动节奏和缓存重载结果符合镜头要求。

### 版本提示
旧社区案例只提供诊断候选，不证明同一故障存在于所有新版；不要照抄其倍率和步数。

<!-- wiki {"id":"topic-gltf","kind":"topic","aliases":["glTF","GLB","导出","游戏资产","web asset"],"sources":["S-GLTF","S-GLASS"],"related":["recipe-gltf-material","recipe-export-scale","workflow-game-asset"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-gltf"></a>
## glTF：资产兼容性与目标端往返

来源：[S-GLTF](sources.json)、[S-GLASS](sources.json)

### 目标
交付目标运行环境实际能用的资产，而不以导出无报错为终点。

### 前置检查
- 明确目标查看器/引擎、支持扩展、单位、动画和材质能力。
- 保留源场景；准备仅包含授权交付对象的副本或集合。

### 步骤
- 从单一物体与简单材质做一次导出、重新导入和目标端加载，建立兼容基线。
- 核对图像格式、路径与嵌入策略；程序化着色先确认可表示性，必要时烘焙。
- 检查尺度、朝向、法线、动画片段和透明/透射等特殊材质。
- 比较目标端截图与批准参考，记录不可保真的功能及处理方式。

### 排错
- 完整 Blender 节点网络不等于 glTF 材质描述。
- 玻璃和反射差异可能来自照明或目标扩展支持，不仅是导出参数。

### 验收
- 目标端可加载，尺寸、朝向、动画和纹理资源正确。
- 特殊材质已做目标端验收；限制写入交付说明。

### 版本提示
以安装的导出器与目标端版本组合验收；旧社区实例不可当作当前完整格式规范。

<!-- wiki {"id":"topic-headless","kind":"topic","aliases":["headless","background render","批渲染","命令行","blender -b"],"sources":["S-CMD","S-CLI"],"related":["recipe-frame-range","workflow-automation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-headless"></a>
## 后台批处理：参数顺序与文件隔离

来源：[S-CMD](sources.json)、[S-CLI](sources.json)

### 目标
把已确认的场景复制到独立输出任务中，批量运行并逐项检查产物。

### 前置检查
- 先从当前 Blender 的 `--help` 核查参数；记录输入文件和允许写入目录。
- 区分本 CLI 会话与单独 Blender 后台进程，避免多个任务覆盖同一文件。

### 步骤
- 先对一个已保存的测试 blend 做单帧后台渲染，确认引擎和依赖可用。
- 命令按加载文件、设置输出/帧段、触发渲染的顺序组装；路径传独立参数，不拼接未经校验的 shell 字符串。
- 正式任务分配唯一目录和日志，记录输入、帧段、版本、返回码。
- 任务完成逐个检查文件可读性与缺帧；失败只重做确认未完成的工作。

### 排错
- 渲染命令参数的先后会影响设置是否在执行前生效。
- 后台模式没有可依赖的交互窗口；不能把 GUI 操作符照搬进无人值守流程。

### 验收
- 输出目录只包含本任务应有的文件，帧清单与计划一致。
- 失败项及完成项均有记录，未覆盖用户输入或他人产物。

### 版本提示
这里只给参数组织原则；Blender 自身与 blender-cli 是两个不同命令，实际参数以各自 --help 为准。

<!-- wiki {"id":"topic-houdini","kind":"topic","aliases":["Houdini转Blender","SOP","VEX","属性迁移","CGWiki"],"sources":["S-CGWIKI","S-FIELDS","S-ATTR"],"related":["topic-fields","topic-instances","topic-simulation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-houdini"></a>
## Houdini 到 Blender：概念映射而非命令翻译

来源：[S-CGWIKI](sources.json)、[S-FIELDS](sources.json)、[S-ATTR](sources.json)

### 目标
复用已有程序化思维，但重新核对 Blender 的求值、属性和 API 契约。

### 前置检查
- 写出原任务的输入、数据域、变换规则和输出，不从节点名字一对一猜测。
- 区分需要的结果是几何、实例、属性还是有历史状态的模拟。

### 步骤
- 把 SOP 风格几何流映射到 GN 的几何连线，把属性计算作为按消费上下文求值的场。
- Position、Set Position 等只作概念候选；属性名称和 domain 显式核对，不把 @Cd 等名字当作通用约定。
- 散布、采样与状态反馈分别查本 Wiki 的实例、Field 和模拟主题。
- 用极小输入复现数值或几何结果，再迁移完整网络并保留对照图。

### 排错
- VEX 代码不是 bpy 代码，也不能直接粘到 GN 节点中执行。
- 概念相近不意味着缓存、线程或数据所有权相同。

### 验收
- 最小网络与原任务在选定样本上的数值/视觉结果可对照。
- 记录不能等价迁移的部分，而不是宣称逐节点自动兼容。

### 版本提示
CGWiki 是原作者的跨工具学习经验；候选节点仍需当前 Blender 官方文档和现场能力发现。

<!-- wiki {"id":"topic-versions","kind":"topic","aliases":["版本","version","API迁移","5.2","4.4","旧教程"],"sources":["S-RELEASES","S-SLOTS","S-CLI"],"related":["topic-python","topic-animation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="topic-versions"></a>
## 版本核查：旧教程、节点与 API 迁移

来源：[S-RELEASES](sources.json)、[S-SLOTS](sources.json)、[S-CLI](sources.json)

### 目标
把学习材料的版本和实际执行环境分开，防止把滚动网页当作稳定运行契约。

### 前置检查
- 记录 Blender、CLI、MCP 扩展和涉及的导出器版本。
- 保存当前输入副本，确认是否必须与旧软件往返。

### 步骤
- 先只读获取当前版本和实际工具 schema，再查对应版本的官方手册。
- 对旧教程列出待核对点：节点存在性、输入名称、操作符参数、动画数据结构及输出颜色配置。
- 在副本上执行一个小样，检查结果与重新打开行为后再迁移批量任务。
- 将使用的文档版本、已验证环境和未验证环节写入结果记录。

### 排错
- latest/current 会变化，来源的复核日期不是网页内容快照。
- 发行版存在不意味着本知识库的所有流程已在该版本测试。

### 验收
- 执行方案没有依赖未核实的旧参数或不存在的工具。
- 报告明确源材料版本与实测环境，兼容性结论有具体证据。

### 版本提示
所有条目当前 runtime_tested:false；不能因 Node 检索测试通过而提高 Blender 运行验证级别。

<!-- wiki {"id":"recipe-context","kind":"recipe","aliases":["operator poll failed","context is incorrect","poll失败","上下文错误"],"sources":["S-OPERATORS","S-SURF","S-DUCK"],"related":["topic-python"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-context"></a>
## 排错：operator poll failed / 上下文不匹配

来源：[S-OPERATORS](sources.json)、[S-SURF](sources.json)、[S-DUCK](sources.json)

### 目标
定位操作符缺少的上下文条件，不靠重复执行碰运气。

### 前置检查
- 保留原始异常、操作符名和参数；确认此前是否已有部分修改。

### 步骤
- 读取模式、活动对象、选择集合和可用编辑器，查询操作符当前文档。
- 检查 `poll()` 与目标类型；优先用不依赖 UI 的数据 API 表达同一改动。
- 确需切换模式或上下文时只改本任务允许的状态，完成后恢复；后台不存在所需窗口时明确停止。

### 排错
- 只选中对象不一定已设为活动对象。
- 不能捕获异常后仍把结果标记为成功。

### 验收
- 操作在明确满足的前置条件下完成。
- 目标变化可验证，其他选择和模式得到妥善恢复。

### 版本提示
新旧 Blender 的上下文覆盖写法不同，禁止直接复用旧字典 override 示例。

<!-- wiki {"id":"recipe-missing-texture","kind":"recipe","aliases":["贴图丢失","粉色","missing texture","紫色","找不到贴图"],"sources":["S-PBR","S-COLOR","S-GLTF"],"related":["topic-materials"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-missing-texture"></a>
## 排错：贴图丢失、粉色或资源搬家

来源：[S-PBR](sources.json)、[S-COLOR](sources.json)、[S-GLTF](sources.json)

### 目标
找出实际缺失的图像资源并恢复正确引用。

### 前置检查
- 记录缺失图像、材质和对象；确认可访问的素材根目录。

### 步骤
- 逐个检查图像数据块的路径、打包状态及文件是否存在，先列出问题清单。
- 在授权素材目录中按名称和内容核对，不能把同名但不同内容的文件直接替换。
- 恢复路径或重新载入后检查 UV、颜色空间和渲染小样；需要交接时再验证资源可携带性。

### 排错
- 粉色可来自缺失图像；黑色或全白还应检查连接、材质分配与照明。
- 不要递归扫描用户未授权的整个磁盘寻找素材。

### 验收
- 所有交付所需图像都能解析并载入。
- 移动到测试目录重新打开后材质仍正确。

### 版本提示
图像路径修复是检查流程，使用的 UI/API 入口以现场版本为准。

<!-- wiki {"id":"recipe-normal-map","kind":"recipe","aliases":["normal map","法线贴图","凹凸反向","normal seam"],"sources":["S-COLOR","S-PBR","S-BAKE"],"related":["topic-materials","recipe-mesh-normals"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-normal-map"></a>
## 排错：法线贴图凹凸反向或接缝

来源：[S-COLOR](sources.json)、[S-PBR](sources.json)、[S-BAKE](sources.json)

### 目标
区分法线纹理解释错误与几何本身的朝向问题。

### 前置检查
- 保留原图，确认贴图空间、UV、烘焙约定和目标渲染器。

### 步骤
- 先关闭法线贴图，观察几何与基础平滑是否已经异常。
- 核对数据纹理颜色空间、Normal Map 节点、空间和 UV；不要把 RGB 颜色直接接入法线。
- 使用已知凸起测试图比较通道方向；确认约定不一致后才在副本中测试通道翻转。

### 排错
- 不应把翻转绿色通道当作所有凹凸问题的通用修复。
- 法线图与高度图不能互换节点后宣称结果等价。

### 验收
- 旋转光源时凸凹响应正确，无明显接缝。
- 目标端与 Blender 在相同约定下的方向一致。

### 版本提示
核对烘焙器与目标端的法线空间和通道约定；不从文件名臆测。

<!-- wiki {"id":"recipe-mesh-normals","kind":"recipe","aliases":["几何法线","黑面","翻面","mesh normals","non manifold"],"sources":["S-BMESH","S-BEVEL","S-SCAN"],"related":["topic-bmesh","topic-modifiers"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-mesh-normals"></a>
## 排错：几何法线、黑面和意外破面

来源：[S-BMESH](sources.json)、[S-BEVEL](sources.json)、[S-SCAN](sources.json)

### 目标
确认表面朝向和拓扑，避免用材质参数遮掩网格问题。

### 前置检查
- 检查对象负缩放、重复面、退化面以及是否本应为封闭实体。

### 步骤
- 在副本中禁用法线贴图并逐个隔离修改器，确定问题发生在哪一层。
- 用面朝向显示或网格查询检查错误区域，核对重叠几何与连接关系。
- 只对明确的区域修正拓扑和朝向；开口薄片需按设计决定正面，不能自动推断内外。

### 排错
- 非流形并非所有资产的错误，例如有意的单面布片。
- 全局重新计算法线可能改变刻意制作的表面效果。

### 验收
- 关键视角无非预期背面或破面。
- 必要的薄片、硬边与表面设计得到保留。

### 版本提示
平滑和自定义法线相关 API 需现场核对；不要批量删除所有法线数据。

<!-- wiki {"id":"recipe-bevel","kind":"recipe","aliases":["倒角不均","bevel artifacts","倒角消失","夹面"],"sources":["S-BEVEL"],"related":["topic-modifiers"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-bevel"></a>
## 排错：倒角不均匀、消失或夹面

来源：[S-BEVEL](sources.json)

### 目标
找到倒角结果异常的尺度、拓扑或限制条件。

### 前置检查
- 保留参数化源对象，读取尺寸、缩放、倒角宽度和修改器顺序。

### 步骤
- 在副本上逐项核对非均匀缩放、边长与倒角宽度的关系。
- 缩小宽度并简化段数，观察是否由重叠限制或局部短边造成。
- 隔离倒角前的布尔/细分结果，修复明确的问题后再恢复完整堆栈。

### 排错
- 关闭重叠保护可能只是把问题变成自交。
- 直接应用缩放前要检查动画、绑定和共享依赖。

### 验收
- 期望边缘得到连续高光，无意外夹面。
- 关键尺寸和轮廓未超出容差。

### 版本提示
不要写死某一版本的默认宽度、平滑选项或限制类型。

<!-- wiki {"id":"recipe-uv-stretch","kind":"recipe","aliases":["UV拉伸","UV stretching","棋盘变形","纹素不均"],"sources":["S-UV"],"related":["topic-uv"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-uv-stretch"></a>
## 排错：UV 拉伸与纹素密度不均

来源：[S-UV](sources.json)

### 目标
定位具体拉伸区域并修正布局，而非反复全局自动展开。

### 前置检查
- 明确允许重叠与重点可见区域，保留已有布局副本。

### 步骤
- 应用棋盘测试并标记变形和尺寸跳变区域。
- 检查对应几何、接缝和岛屿形状，局部重展或增加合理切口。
- 按交付分辨率重新分配岛屿面积和边距，复核材质使用的 UV 层。

### 排错
- 几何存在细长退化面时只改 UV 可能不够。
- 有意复用的镜像岛不应被自动拆除。

### 验收
- 主要可见面棋盘比例和大小符合预期。
- 接缝与重叠状态符合资产要求。

### 版本提示
展开方法选择与打包参数使用当前版本支持的设置。

<!-- wiki {"id":"recipe-bake-target","kind":"recipe","aliases":["No active image","active image texture","烘焙目标","目标图像"],"sources":["S-BAKE","S-BAKE-CASE"],"related":["topic-baking"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-bake-target"></a>
## 排错：No active image / 烘焙目标不明确

来源：[S-BAKE](sources.json)、[S-BAKE-CASE](sources.json)

### 目标
明确每个参与烘焙材质最终写入哪张图像。

### 前置检查
- 先备份源贴图，确认目标对象的全部材质槽与 UV。

### 步骤
- 逐材质检查 Image Texture 节点的图像引用以及活动、选中状态。
- 为目标建立独立图像并明确激活，避免把源图像当输出；无目标的材质先停止处理。
- 低分辨率执行小样，确认实际改变的是目标图像，再保存并重新载入检查。

### 排错
- 图像编辑器正在显示一张图，不等于它就是每个材质的烘焙目标。
- 存在多个材质槽时不能只检查第一个。

### 验收
- 所有应烘焙材质都有明确目标图像。
- 源图未被改写，目标内容和保存路径正确。

### 版本提示
社区案例涉及旧版本歧义；以当前烘焙手册和实测写入对象为准。

<!-- wiki {"id":"recipe-bake-black","kind":"recipe","aliases":["烘焙全黑","black bake","烘焙空白","投射错误"],"sources":["S-BAKE","S-SCAN"],"related":["topic-baking","recipe-bake-target"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-bake-black"></a>
## 排错：烘焙全黑、空白或投射错误

来源：[S-BAKE](sources.json)、[S-SCAN](sources.json)

### 目标
分开检查目标、通道、几何投射和光照因素。

### 前置检查
- 确认查看的是刚烘焙的目标图像，而不是旧文件或其他节点。

### 步骤
- 先按 recipe-bake-target 确认输出，再检查 UV 和参与的材质。
- 核对烘焙通道及贡献项；颜色输出与含光照输出使用不同验收标准。
- 高低模时核对活动低模、源对象、cage 或投射距离，用小区域重测后再扩展。

### 排错
- 把所有黑图问题都归因于缺灯会漏掉目标错误。
- 增加样本数不能修复 UV、投射或通道选择错误。

### 验收
- 代表性区域包含预期信号而不是全空。
- 投射覆盖、缝边和通道用途得到验证。

### 版本提示
不同版本支持的烘焙类型与目标可能变化，先核对再生成参数。

<!-- wiki {"id":"recipe-field-domain","kind":"recipe","aliases":["field domain","属性全零","场不生效","domain错误"],"sources":["S-FIELDS","S-ATTR","S-FIELD-CASE"],"related":["topic-fields"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-field-domain"></a>
## 排错：field domain 错误、属性全零

来源：[S-FIELDS](sources.json)、[S-ATTR](sources.json)、[S-FIELD-CASE](sources.json)

### 目标
追踪一个场实际在哪份几何与哪个域上被求值。

### 前置检查
- 列出属性名称、数据类型、源几何和消费节点。

### 步骤
- 缩减到少量点/面，通过 Viewer 或 Spreadsheet 读取已知样本。
- 沿字段连线回看消费节点的几何上下文；跨几何采样时分清源值和目标采样位置。
- 核对捕获或存储所在的域与拓扑变化位置，逐段恢复完整网络。

### 排错
- 同名 Position 节点并不保证指向同一几何。
- 属性不存在与属性真实为零是两种情况，应分别核查。

### 验收
- 样本值与手工预期相符。
- 扩大输入后属性仍按预期传播。

### 版本提示
节点 socket 和域选项以现场版本为准；旧截图只作思路参考。

<!-- wiki {"id":"recipe-scatter-direction","kind":"recipe","aliases":["散布方向","实例朝向","scatter direction","植物横躺"],"sources":["S-INSTANCES","S-CGWIKI"],"related":["topic-instances"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-scatter-direction"></a>
## 排错：散布方向错误或植物横躺

来源：[S-INSTANCES](sources.json)、[S-CGWIKI](sources.json)

### 目标
分离源资产局部轴、表面法线和随机旋转三种影响。

### 前置检查
- 保留 seed 和输入几何，只选少量容易观察的点测试。

### 步骤
- 暂时取消随机旋转，检查源资产的局部上轴、原点和缩放。
- 核对表面法线与实例对齐轴，在一个已知方向的面上验证。
- 恢复绕正确轴的随机变化，再检查坡面、边缘及镜像变换区域。

### 排错
- 随意旋转全部实例可能只修好一个坡面。
- 源资产和实例两处同时补偿容易产生双重旋转。

### 验收
- 水平面与倾斜面上的朝向均正确。
- 恢复随机性后无非预期翻转或根部离地。

### 版本提示
方向对齐节点与旋转类型可能变化，查当前候选节点而非固定旧名。

<!-- wiki {"id":"recipe-realize-memory","kind":"recipe","aliases":["实例内存","realize memory","实体化卡死","实例转网格"],"sources":["S-INSTANCES"],"related":["topic-instances"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-realize-memory"></a>
## 排错：实体化实例后内存暴涨

来源：[S-INSTANCES](sources.json)

### 目标
查明是否确需独立网格，并控制实体化范围。

### 前置检查
- 记录源网格复杂度、实例数量和下游真实需求。

### 步骤
- 先在可恢复副本关闭或绕过实体化，比较几何统计与响应。
- 检查下游是否可直接处理实例；只对确需编辑的子集进行实体化。
- 用小样估算扩大后的几何量，降低源资产细节或分批交付，并记录代价。

### 排错
- 盲目增加超时不会降低几何数量。
- 几何估算不是精确内存上限，还需测目标环境。

### 验收
- 目标效果保留且不再无谓实体化全部内容。
- 达到目标数量的测试资源消耗可接受。

### 版本提示
导出器实例支持与节点性能随版本变化，保留兼容测试结果。

<!-- wiki {"id":"recipe-simulation-cache","kind":"recipe","aliases":["模拟跳帧","simulation cache","缓存失效","重开模拟"],"sources":["S-SIM","S-SIM-BAKE"],"related":["topic-simulation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-simulation-cache"></a>
## 排错：模拟跳帧、缓存失效或重开不同

来源：[S-SIM](sources.json)、[S-SIM-BAKE](sources.json)

### 目标
先排查时间状态和缓存一致性，再调整模拟规则。

### 前置检查
- 记录起止帧、帧率、输入变更与缓存目录，确认缓存归属。

### 步骤
- 从起始帧顺序播放短段，对比直接跳帧时的结果。
- 检查是否修改过初始状态或输入；只在确认可重建时清理本任务对应缓存。
- 保存场景并重新烘焙，重开副本后抽查非顺序帧和跨目录依赖。

### 排错
- 不能为修复一个对象而无差别删除整项目缓存。
- 缓存文件存在不说明内容对应当前输入。

### 验收
- 连续播放与缓存随机抽帧结果一致。
- 场景重开及交付路径下仍可使用缓存。

### 版本提示
先辨别具体模拟系统；GN、布料与其他系统缓存方式不可混用。

<!-- wiki {"id":"recipe-black-render","kind":"recipe","aliases":["黑帧","black render","空画面","相机不对"],"sources":["S-SAMPLE","S-CMD"],"related":["topic-rendering"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-black-render"></a>
## 排错：渲染黑帧、空画面或错镜头

来源：[S-SAMPLE](sources.json)、[S-CMD](sources.json)

### 目标
按场景、相机、可见性、照明和输出链路逐层定位。

### 前置检查
- 保存失败文件、日志和实际帧号，确认不是在看旧产物。

### 步骤
- 检查活动场景、相机、视图层、帧号及对象渲染可见性。
- 低分辨率测试基础材质和照明；在副本中逐步隔离遮挡、合成与序列器影响。
- 核对输出路径、透明通道和查看器解释，再恢复完整配置渲染小样。

### 排错
- 透明画面在黑色查看器底色上可能被误认为黑帧。
- 视口能看到对象不代表最终渲染可见。

### 验收
- 小样呈现正确镜头内容，透明度按要求输出。
- 正式产物尺寸、帧号和保存位置正确。

### 版本提示
合成和引擎具体选项必须现场查询；不硬编码旧版渲染标识。

<!-- wiki {"id":"recipe-noise","kind":"recipe","aliases":["噪点","noise","fireflies","降噪涂抹","闪烁"],"sources":["S-SAMPLE"],"related":["topic-rendering"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-noise"></a>
## 排错：渲染噪点、降噪涂抹和闪烁

来源：[S-SAMPLE](sources.json)

### 目标
在质量和成本之间做可比较的小样实验。

### 前置检查
- 固定相机、帧号、光照和测试区域，记录当前采样配置。

### 步骤
- 先比较未降噪与降噪结果，区分采样不足和细节被抹除。
- 对困难区域逐项调整采样或照明方案，记录时间和细节变化。
- 动画检查连续帧的稳定性，不只看单张；确认后再扩大分辨率或帧段。

### 排错
- 极强的小亮点与复杂间接光需要定位来源，不能只无上限加样本。
- 单帧降噪看似干净不保证视频没有闪烁。

### 验收
- 相同查看尺度下噪点与细节满足要求。
- 连续帧没有明显漂移涂抹，成本有记录。

### 版本提示
具体阈值、降噪后端和设备支持按当前版本实测选择。

<!-- wiki {"id":"recipe-color-mismatch","kind":"recipe","aliases":["EXR太暗","偏色","color mismatch","重复色彩转换"],"sources":["S-COLOR","S-AGX"],"related":["topic-color"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-color-mismatch"></a>
## 排错：EXR 太暗、交接偏色或过度对比

来源：[S-COLOR](sources.json)、[S-AGX](sources.json)

### 目标
确认输入解释与显示变换是否一致，不通过随意增亮掩盖错误。

### 前置检查
- 保留原始文件和批准参考，收集双方颜色管理设置。

### 步骤
- 确认输出是场景线性中间文件还是已应用显示变换的图片。
- 核对目标软件的输入色彩空间、曝光、View Transform 与显示设置。
- 用同一测试帧逐项对照，排除重复转换后再进行创作性调色。

### 排错
- 扩展名不能完整说明 EXR 的色域和通道语义。
- 不要对法线或粗糙度数据图应用显示用校正。

### 验收
- 匹配颜色链路后灰阶、高光与关键颜色一致。
- 交付附带足够设置说明，可在接收端复现。

### 版本提示
旧文章只解释线性/显示的关系；新工作空间和 OCIO 配置需现场读取。

<!-- wiki {"id":"recipe-animation-still","kind":"recipe","aliases":["关键帧不动","animation still","action slot","动画无效"],"sources":["S-ACTIONS","S-SLOTS"],"related":["topic-animation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-animation-still"></a>
## 排错：有关键帧但对象不动

来源：[S-ACTIONS](sources.json)、[S-SLOTS](sources.json)

### 目标
找到动画数据与目标关联、时间映射或覆盖关系的问题。

### 前置检查
- 确认应变化的数据块、具体属性与测试帧。

### 步骤
- 比较两个关键时间的属性值，确认曲线不是相同常值。
- 检查对象/骨骼/形态键/节点树的 Action 与 Slot 关联是否正确。
- 检查 NLA 的时间范围与混合、约束和驱动覆盖；在副本逐项隔离后再恢复。

### 排错
- 只看到 Action 名字不能证明当前目标绑定了正确插槽。
- 图表显示过滤器可能隐藏曲线，先查询真实数据再删动画。

### 验收
- 目标在指定时间点达到预期值或姿态。
- 重开和目标端播放仍有效，无无关动画丢失。

### 版本提示
4.4 前后动作结构有变化，旧式 F-Curve 操作需进行版本适配。

<!-- wiki {"id":"recipe-cloth-penetration","kind":"recipe","aliases":["布料穿透","cloth penetration","布料爆炸","cloth collision"],"sources":["S-CLOTH","S-CLOTH-CASE"],"related":["topic-cloth","workflow-cloth"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-cloth-penetration"></a>
## 排错：布料穿透、爆炸与自挤压

来源：[S-CLOTH](sources.json)、[S-CLOTH-CASE](sources.json)

### 目标
优先定位初始间距、尺度和碰撞设置，逐步得到稳定接触。

### 前置检查
- 保留失败帧、起始状态和缓存；确认可重建的本任务模拟。

### 步骤
- 检查布料与碰撞体是否启用正确碰撞，以及起始网格是否已经相交或小于碰撞间距。
- 核对空间尺度、固定权重与快速运动；在短段小样中逐项测试碰撞质量和时间分辨率。
- 调整后仅重建本任务缓存，逐帧观察首次接触与最剧烈运动，再检查厚度/细分影响。

### 排错
- 把碰撞距离调得过大会导致漂浮或自挤压。
- 旧论坛中的统一放大倍率并不适用于所有镜头。

### 验收
- 关键接触帧无可见穿透或爆炸。
- 固定点与运动表现符合设计，重开缓存可复现。

### 版本提示
社区案例是排查候选，不是新版缺陷结论；参数由现场小样决定。

<!-- wiki {"id":"recipe-gltf-material","kind":"recipe","aliases":["gltf missing material","GLB丢材质","网页材质","玻璃导出"],"sources":["S-GLTF","S-GLASS"],"related":["topic-gltf","topic-materials"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-gltf-material"></a>
## 排错：glTF 丢材质或网页表现不同

来源：[S-GLTF](sources.json)、[S-GLASS](sources.json)

### 目标
区分导出器表示限制、缺失资源与目标端渲染差异。

### 前置检查
- 记录导出器、目标引擎和所需扩展，准备一个失败材质的小样。

### 步骤
- 先检查导出文件是否确实包含目标图像和材质关联，排除路径与选择范围错误。
- 将材质简化为可支持的基本网络，对程序化部分测试烘焙替代。
- 在目标端匹配照明与色彩解释，检查透明/透射等扩展，再逐项恢复复杂参数。

### 排错
- 目标端不支持的着色特性不能仅靠重导出修复。
- 不能把旧案例中的玻璃限制当作所有当前版本的规范。

### 验收
- 目标端资源完整，基础材质表现正确。
- 特殊效果有目标端截图验收，无法等价的部分明确标注。

### 版本提示
实时查询当前导出器选项及目标扩展支持，不能从 Blender 预览推断交付成功。

<!-- wiki {"id":"recipe-export-scale","kind":"recipe","aliases":["导出比例","export scale","轴向错误","模型太小","朝向错误"],"sources":["S-GLTF"],"related":["topic-gltf","workflow-game-asset"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-export-scale"></a>
## 排错：导出比例、朝向或镜像错误

来源：[S-GLTF](sources.json)

### 目标
用可测量的参照物校对源场景、导出器和目标端约定。

### 前置检查
- 保留源对象变换、单位设置和目标端导入配置。

### 步骤
- 用已知尺寸且方向明确的小样做导出与目标端加载。
- 分别检查对象变换、单位换算与坐标轴转换，避免在两端重复补偿。
- 在交付副本调整后，检查绑定、动画和负尺度影响，再处理完整资产。

### 排错
- 不能因模型尺寸错误就把所有对象统一缩放并应用。
- 只检查静态模型会漏掉动画或骨架单位问题。

### 验收
- 目标端测得尺寸和正方向与约定相符。
- 动画、法线和层级没有被修复动作破坏。

### 版本提示
不同格式和引擎的约定不同，本条不是通用的固定轴向参数。

<!-- wiki {"id":"recipe-frame-range","kind":"recipe","aliases":["序列缺帧","frame range","missing frames","帧号错误"],"sources":["S-CMD"],"related":["topic-headless","workflow-animation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-frame-range"></a>
## 排错：序列缺帧、错帧和输出覆盖

来源：[S-CMD](sources.json)

### 目标
按计划清单检查实际文件，而不是只看进程是否正常退出。

### 前置检查
- 记录起止帧、步长、输出模板、格式和本任务目录。

### 步骤
- 核对场景帧范围与命令参数顺序，确保输出设置在触发渲染前生效。
- 按清单逐帧检查文件存在、非空、可解码和尺寸，分开记录缺失与损坏。
- 确认没有仍在写入的进程后，只补渲染明确失败帧；保留有效帧与原日志。

### 排错
- 文件数量正确仍可能存在重复帧号、旧文件或损坏文件。
- 用新任务覆盖原序列会破坏已验收结果。

### 验收
- 清单中的每一帧均可读取，命名与时间范围正确。
- 抽查首中尾及连续运动，未混入其他版本的帧。

### 版本提示
具体帧命名与参数采用现场 Blender --help；不把 CLI 返回码当作图像解码检查。

<!-- wiki {"id":"recipe-timeout","kind":"recipe","aliases":["工具超时","MCP timeout","断线","重试","session recovery"],"sources":["S-CLI"],"related":["topic-agent","workflow-automation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="recipe-timeout"></a>
## 排错：工具超时、断线与安全恢复

来源：[S-CLI](sources.json)

### 目标
先核实已提交操作的实际状态，避免恢复时重复建模、渲染或写文件。

### 前置检查
- 保留工具名、参数、请求时间、错误和已完成 batch 项。

### 步骤
- 用 `session status` 及只读应用/产物检查判断原操作是否还在执行或已经完成。
- 连接可用时读取目标状态与输出；结果不明时停止写操作，不自动重放。
- 确需恢复时显式重建自己的会话，重新发现 schema，仅执行已确认未完成的步骤。

### 排错
- 超时只表示没有按时收到响应，不等于 Blender 已撤销操作。
- 不得结束其他任务会话或强杀用户应用来抢占资源。

### 验收
- 完成项与待处理项清楚，无重复对象或覆盖产物。
- 恢复报告列明不确定状态以及核验依据。

### 版本提示
遵守本仓库会话和不自动重试约定；Wiki 查询不需要建立 MCP 连接。

<!-- wiki {"id":"workflow-product-shot","kind":"workflow","aliases":["产品静帧","产品渲染","product shot","电商渲染","宣传片静帧"],"sources":["S-CLI","S-BEVEL","S-PBR","S-SAMPLE","S-AGX"],"related":["topic-modifiers","topic-materials","topic-rendering","topic-color"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="workflow-product-shot"></a>
## 工作流：产品静帧，从需求到交付

来源：[S-CLI](sources.json)、[S-BEVEL](sources.json)、[S-PBR](sources.json)、[S-SAMPLE](sources.json)、[S-AGX](sources.json)

### 目标
把已有产品资产或简单建模需求转为一张可交付、可复现的静帧；审美验收与技术验收分开。

### 前置检查
- 明确产品尺寸、不可改变的外观、参考图、画幅、交付分辨率、透明背景与文字安全区。
- 确认可用模型/贴图、使用权限、工作副本及输出目录；有真实产品时不擅自补造接口或结构。

### 步骤
- 检索需要的知识，再建立目标会话并发现实际工具；只读盘点场景、产品对象、材质和当前版本。
- 先做灰模构图：确定相机、产品比例、地面关系和留白，在低分辨率预览中确认关键轮廓可读；不要一开始堆高细节。
- 根据近景需要检查倒角、法线和修改器，只在副本做可逆修改，保留原资产和真实结构约束。
- 从简洁材质及少量可解释灯光建立层次，分别确认轮廓、高光与材质区别；新增贴图要核对语义和来源。
- 把候选画面与参考并排检查，分开记录构图、材质、照明和内容准确性问题；每轮只调整明确问题，避免无目标改参。
- 确认色彩链路和交付设置后渲染正式图片，检查尺寸、透明通道、噪声、焦点和文字留白；原始中间文件与展示图分别保存。
- 整理可编辑 blend、依赖资源、最终图、预览以及版本/设置记录；验收完成后按需结束自己的 MCP 会话并保留应用。

### 排错
- “文件已生成”不能证明造型正确或画面好看，仍需视觉检查或用户确认。
- 为提高质感添加不存在的硬件细节会偏离产品事实；为了提亮随意修改颜色管理会影响整套交付。

### 验收
- 技术：最终图可解码，尺寸/通道/路径正确，源模型与依赖资源可复用。
- 视觉与内容：产品结构、比例和关键颜色符合参考，轮廓清晰，构图和留白满足版式，未验证的审美项明确标注。

### 版本提示
不固定引擎版本、灯光功率或样本数。流程为原创组织建议；所有 Blender 操作仍需现场工具与小样验证。

<!-- wiki {"id":"workflow-game-asset","kind":"workflow","aliases":["游戏模型","游戏资产","网页模型","game asset","web asset","glTF工作流"],"sources":["S-CLI","S-UV","S-BAKE","S-GLTF","S-GLASS"],"related":["topic-uv","topic-baking","topic-gltf","recipe-export-scale","recipe-gltf-material"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="workflow-game-asset"></a>
## 工作流：游戏/网页资产到 glTF 验收

来源：[S-CLI](sources.json)、[S-UV](sources.json)、[S-BAKE](sources.json)、[S-GLTF](sources.json)、[S-GLASS](sources.json)

### 目标
在面数、纹理和运行时能力约束下制作可以在目标端加载的资产。

### 前置检查
- 确认目标引擎及版本、单位、轴向、面数/纹理预算、动画与特殊材质需求。
- 保留源文件和高模；明确允许导出的对象与资源。

### 步骤
- 先用一个简单对象做目标端导入测试，锁定单位、朝向和最基本材质链路。
- 在副本完成网格整理，检查法线、拓扑、原点与必要修改器；按实际观看距离分配几何细节。
- 规划 UV 和纹素密度，用棋盘检测重点区域，再烘焙必要通道；逐一确认目标图像并保存，不覆盖源图。
- 按目标端支持范围构建材质，检查通道打包、法线约定、透明或透射扩展；无法表示的部分用明确替代方案。
- 对需要动画的资产检查正确的 Action/Slot、片段与层级，在 Blender 中先验证首尾姿态。
- 导出到唯一输出目录，在目标端重新加载，比较尺寸、朝向、资源、动作与材质；统计实际文件与运行成本。
- 提交资产、预览和目标端验收记录；只有 Blender 内重新导入成功时，不宣称已完成引擎兼容验证。

### 排错
- 模型能打开不等于材质、动画、法线或扩展都正确。
- 不要把源场景中的隐藏参考物、私有路径或无关资源一并交付。

### 验收
- 目标端成功加载且尺寸、方向、动作和资源无缺失。
- 运行成本符合约定，特殊材质有截图/播放证据，不能保真的部分有说明。

### 版本提示
glTF 导出器与目标端是联合版本契约；跨版本升级后重新做最小往返测试。

<!-- wiki {"id":"workflow-scatter","kind":"workflow","aliases":["程序化散布","植被散布","scatter workflow","几何节点工作流"],"sources":["S-CLI","S-FIELDS","S-ATTR","S-INSTANCES","S-CGWIKI"],"related":["topic-fields","topic-instances","recipe-scatter-direction","recipe-realize-memory"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="workflow-scatter"></a>
## 工作流：程序化散布与可控变化

来源：[S-CLI](sources.json)、[S-FIELDS](sources.json)、[S-ATTR](sources.json)、[S-INSTANCES](sources.json)、[S-CGWIKI](sources.json)

### 目标
将分布规则转成可检查的几何节点网络，并在扩大数量前证明规则正确。

### 前置检查
- 明确散布范围、排除区、密度、资产尺寸、方向规则和重复变化策略。
- 准备低成本源资产和小型测试表面，记录输入版本与随机种子。

### 步骤
- 建立会话并检查当前节点能力；用少量点连通表面分布、实例与输出，先确认基础几何正确。
- 用可视化字段检查密度与排除条件，核对这些字段实际在哪个域求值。
- 固定一个实例检查源资产局部轴、原点与表面法线，再扩展到坡面与边缘。
- 逐项添加旋转、尺度和资源变体，区分确定性规则与随机规则，并比较重复运行结果。
- 按小、中、目标规模检查交叠、边界、内存与响应；需要实体化的子集单独测试，不默认实体化全部。
- 保存参数化源场景和低成本预览，在目标交付路径检查材质及实例支持，记录验收与限制。

### 排错
- 视觉上自然的随机分布仍可能违反密度或排除区约束。
- 拓扑变化可能改变逐点对应，不能只保存 seed 就宣称跨版本完全一致。

### 验收
- 排除区、密度、朝向与尺度符合规则，小样的字段数据可以解释。
- 目标规模可运行，结果在明确的相同输入条件下复现，交付端能读取需要的几何。

### 版本提示
节点与实例导出支持以现场版本为准。这里提供图的构造意图，不承诺自动适配任意旧节点网络。

<!-- wiki {"id":"workflow-cloth","kind":"workflow","aliases":["布料镜头","cloth workflow","布料工作流","服装模拟"],"sources":["S-CLI","S-CLOTH","S-CLOTH-CASE","S-SIM-BAKE","S-SAMPLE"],"related":["topic-cloth","recipe-cloth-penetration","topic-simulation"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="workflow-cloth"></a>
## 工作流：布料镜头的试算、缓存与交付

来源：[S-CLI](sources.json)、[S-CLOTH](sources.json)、[S-CLOTH-CASE](sources.json)、[S-SIM-BAKE](sources.json)、[S-SAMPLE](sources.json)

### 目标
从镜头要求得到稳定可复现的布料运动，再投入最终画面质量。

### 前置检查
- 明确镜头帧段、帧率、碰撞对象运动、固定区域和布料尺度。
- 保存场景副本并约定可重建缓存目录，不影响其他任务模拟。

### 步骤
- 只读盘点布片、碰撞体、关键帧与修改器，检查初始相交和缩放依赖。
- 用简化几何先做短段试算，分别验证固定点、重力与碰撞，保存失败首次出现的帧。
- 按 recipe-cloth-penetration 排查间距、尺度和快速运动，再逐项提高必要质量；不同时随机调整大量参数。
- 确认运动符合镜头意图后测试细分与厚度的顺序，检查这些细节是否改变接触或增加不必要成本。
- 按当前布料系统的实际入口烘焙并保存，重开副本抽查首中尾和最剧烈运动帧，确认缓存可携带。
- 先渲染连续低成本预览检查抖动与节奏，再输出正式帧及场景/缓存/设置清单。

### 排错
- 只看某一静帧无法发现穿透瞬间或运动抖动。
- GN 模拟缓存手册只能提示通用交付原则，布料应使用布料自己的缓存入口。

### 验收
- 关键接触与运动帧无明显穿透或爆炸，固定区域与节奏符合要求。
- 完整帧段可重载与渲染，缓存和场景版本对应，交付记录说明实测范围。

### 版本提示
物理参数没有跨尺度通用值，先小样再扩大。未在实际 Blender 中执行前不将此配方标记为已验证。

<!-- wiki {"id":"workflow-animation","kind":"workflow","aliases":["动画序列","animation workflow","镜头动画","序列渲染","EXR交接"],"sources":["S-CLI","S-ACTIONS","S-SLOTS","S-CMD","S-AGX"],"related":["topic-animation","topic-rendering","recipe-frame-range","recipe-color-mismatch"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="workflow-animation"></a>
## 工作流：动画镜头到图像序列交接

来源：[S-CLI](sources.json)、[S-ACTIONS](sources.json)、[S-SLOTS](sources.json)、[S-CMD](sources.json)、[S-AGX](sources.json)

### 目标
把时间、动作和图像输出关联起来，交付可连续播放、颜色解释明确的序列。

### 前置检查
- 确认镜头时长、帧率、起止帧、相机运动与交付格式。
- 记录现有动画、依赖模拟、输出目录及批准的画面参考。

### 步骤
- 在目标会话中读取场景版本和动画目标，验证 Action/Slot、约束和驱动关联。
- 先做低成本预览，检查关键姿态、镜头速度、首尾和转场需求；用连续播放而非稀疏截图验收节奏。
- 确认涉及的模拟或时序资产有对应缓存，并在正式渲染前做重开与抽帧测试。
- 锁定渲染尺寸、帧率、输出模板和色彩链路；后期中间 EXR 与显示用预览分别标注。
- 先渲染首中尾小样及复杂片段，检查构图、噪声与细节，再批量输出完整序列。
- 按帧清单检查存在性、可解码性、尺寸和版本一致性，补齐确认失败的帧；连续播放排查闪烁与重复帧。
- 交付序列、带帧号预览、场景与设置说明，在目标后期软件中确认帧率和颜色解释。

### 排错
- 预览播放速度与最终帧率不一致时，可能误判节奏。
- 进程成功返回不证明全序列完整；只在 Blender 里看过 EXR 也不等于后期交接完成。

### 验收
- 帧清单完整，序列可连续播放，动作和镜头节奏符合批准方案。
- 目标后期端帧率、颜色与通道解释正确，交付路径和版本可追溯。

### 版本提示
动作数据结构、输出格式选项和颜色工作空间随版本变化，必须记录现场设置。

<!-- wiki {"id":"workflow-automation","kind":"workflow","aliases":["批量自动化","agent automation","batch workflow","自动化工作流"],"sources":["S-CLI","S-OPERATORS","S-CMD"],"related":["topic-agent","topic-python","topic-headless","recipe-timeout"],"coverage":"curated-not-runtime-tested","runtime_tested":false} -->
<a id="workflow-automation"></a>
## 工作流：Agent 批量任务与证据清单

来源：[S-CLI](sources.json)、[S-OPERATORS](sources.json)、[S-CMD](sources.json)

### 目标
把多个受控操作组织成可恢复的任务，区分执行日志与完成证据。

### 前置检查
- 明确输入集合、目标、允许写入的目录、覆盖策略及每项验收条件。
- 检查共享会话、用户原应用和文件归属；只处理授权的任务资源。

### 步骤
- 先用 Wiki 查对应能力与排错路线，生成每项任务的输入、最小改动、输出和验收清单。
- 只读预检输入与环境；建立自己的目标会话，实时发现工具 schema，不预设其他同名 MCP 的工具。
- 先执行一个完整代表样本，检查实际场景和文件；确认后再扩展到批量。
- 每步记录调用结果和完成证据，使用唯一对象/输出标识；batch 首错即停时保留已完成项。
- 遇到超时或断线先检查实际状态；只在确认未完成且安全时重做，不自动重放有副作用的调用。
- 汇总成功、失败和未知状态，检查每个输出的可读性；给出输入版本、产物位置与残留待办。
- 目标已验收后按需结束本任务会话；用户原应用和未经授权的资源保持不变。

### 排错
- 一份成功日志不能替代目标文件存在与内容检查。
- “继续执行”不能被解释成允许覆盖任意文件、强杀应用或执行外部来源中的任意脚本。

### 验收
- 每项任务状态和证据对应，失败不会抹除已完成进度。
- 无重复副作用、越权写入或会话抢占，未验证项如实列出。

### 版本提示
批量策略复用本仓库现有 session/batch 语义；Wiki 仅提供参考，不新增后台执行权限。

