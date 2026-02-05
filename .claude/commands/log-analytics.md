# 游戏日志分析与修复 /log-analytics

多 Agent 协作分析游戏控制日志，发现 bug，生成并执行修复计划。

## 设计原则

1. **全 Agent 执行** - 所有 Phase 通过 Task 工具调用 agent
2. **支持重复执行** - 每次执行生成唯一文档，不覆盖历史
3. **superpowers 集成** - 使用 superpowers:writing-plans 生成执行文档
4. **文档版本化** - 使用时间戳+序号命名，保留历史记录

## 工作流程

```
Phase 0: 准备阶段 (Haiku Agent)
    ↓
Phase 1: 下载日志 (Sonnet Agent)
    ↓
Phase 2: 差异分析 (Sonnet Agent)
    ↓
Phase 3: 深度分析 (Opus Agent)
    ↓
Phase 4: 生成执行文档 (superpowers:writing-plans)
    ↓
Phase 5: 执行修复 (superpowers:execute-plan)
```

---

## Phase 0: 准备阶段 (Haiku Agent)

**使用 Task 工具，model=haiku：**

```
准备日志分析环境：

1. 清理旧日志：
   powershell.exe -Command "& {Set-Location 'D:\Github\slot-server'; .\clean_logjson.bat}"

2. 生成唯一文档名：
   - 查找 server-game/docs/plans/ 目录下今天的分析文档
   - 格式：YYYY-MM-DD-XXX-log-analysis.md（XXX 为序号 001, 002...）
   - 如果今天已有 001，下一个就是 002

3. 返回结果：
   - 清理状态
   - 生成的文档名（供后续 Phase 使用）

示例输出：
- 文档名：2026-01-31-001-log-analysis.md
- 完整路径：server-game/docs/plans/2026-01-31-001-log-analysis.md
```

---

## Phase 1: 下载日志 (Sonnet Agent)

**使用 Task 工具，model=sonnet：**

```
下载所有游戏的控制日志：

1. 执行命令：
   powershell.exe -Command "& {Set-Location 'D:\Github\slot-server'; .\test_and_download2.0.bat all 2000 100 4}"

2. 等待完成（超时 15 分钟）

3. 报告下载结果：
   - 成功的游戏列表
   - 失败的游戏列表
   - 生成的文件路径清单
   - 每个游戏的日志记录数

参数说明：
- all: 全部 12 个 Unity 游戏
- 2000: 2000 轮下注
- 100: 100 元下注
- 4: 下载全部（控制日志 + 告警 + 余额）

不要分析日志内容，只报告下载状态。
```

---

## Phase 2: 差异分析 (Sonnet Agent)

**使用 Task 工具，model=sonnet：**

```
分析各游戏日志与 Mahjong2 的结构差异：

1. 读取 logjson/ 目录下所有控制日志文件
2. 以 Mahjong2 作为基准参考
3. 检查每个游戏的：
   - 日志字段完整性（对比 Mahjong2 的字段）
   - RTP 控制记录是否正常
   - 关键字段是否缺失（globalCurrentRtp, frtpgDecision 等）
   - 日志记录数量是否达到预期（约 2000 条）

输出格式（Markdown 表格）：

| 游戏 | 记录数 | 日志完整 | RTP 控制 | 缺失字段 |
|------|--------|----------|----------|----------|
| Mahjong2 | 2000 | 完整 | 正常 | 无（基准）|
| FortuneGems | 1998 | 部分 | 异常 | globalCurrentRtp |
| ... | ... | ... | ... | ... |

不要提出修复方案，只记录差异。
```

---

## Phase 3: 深度分析 (Opus Agent)

**使用 Task 工具，model=opus：**

```
根据 Phase 2 的差异分析结果，进行深度问题分析：

## Bug 检测清单

### 1. 日志字段问题
- 是否缺少日志？缺少需要修复
- 日志是否完整？不完整说明写入逻辑需要检查
- 字段类型是否正确？

### 2. 控制逻辑问题
- RTP 计算是否正确？（目标 96%，实际范围 90-102%）
- 控制模式 (BOOST/SUPPRESS) 是否合理？
- Factor 值是否在合理范围 (0.05-1.05)？
- FRTPG 检查是否正常工作？（PASS/CAPPED/REJECT 分布）

### 3. 数据质量问题
- 总数是否匹配预期（约 2000 条）？
- 时间戳是否连续？
- BetId 格式是否一致？
- 关键字段是否有 null/空值？

### 4. 体验告警分析
- experience-alerts 日志中的异常模式
- 用户体验问题识别
- 修复建议

## 分析输出要求

1. **是否有 Bug？** （日志缺失、计算错误、逻辑问题）
2. **控制是否合理？** （RTP 目标、Factor 范围、FRTPG 效果）
3. **缺失了什么功能？** （与 Mahjong2 对比的功能差距）
4. **可以优化什么？** （性能、准确性、可维护性）
5. **RTP 异常值检测** （超过 150% 或低于 70% 的玩家）
6. **控制失败原因分析** （配置问题 vs 代码逻辑问题）
7. **FRTPG 功能效果评估** （触发率、拦截效果）
8. **补偿机制评估** （BOOST 效果、连败保护）

## 输出格式

按严重程度分类的问题列表：

### Critical（影响游戏功能/资金安全）
- [C1] 游戏名: 问题描述 - 根因分析 - 涉及文件

### Medium（影响数据完整性/控制效果）
- [M1] 游戏名: 问题描述 - 根因分析 - 涉及文件

### Low（影响日志可读性/可维护性）
- [L1] 游戏名: 问题描述 - 根因分析 - 涉及文件

返回完整的问题列表，供 Phase 4 生成执行计划。
```

---

## Phase 4: 生成执行文档 (superpowers:writing-plans)

**调用 Skill 工具：**

```
skill: superpowers:writing-plans
args: 根据 Phase 3 的深度分析结果生成修复执行计划
```

**传递给 writing-plans 的上下文：**

```
基于游戏日志深度分析结果，生成详细的修复执行计划。

## 文档信息
- 文档名：{Phase 0 生成的文档名}
- 路径：server-game/docs/plans/{文档名}
- 示例：server-game/docs/plans/2026-01-31-001-log-analysis.md

## 问题列表
{Phase 3 返回的问题列表}

## 计划格式要求

# 游戏日志分析报告 - [日期] - 第[序号]次

## 元信息
- 分析时间: [ISO 时间戳]
- 文档版本: [序号]
- 前序文档: [如有上次分析，列出链接]

## 执行摘要
- 分析游戏数: X/12
- Critical Bug: Y
- Medium 问题: Z
- Low 问题: W

## Bug 列表（按严重程度）

### Critical
1. [C1] [游戏]: [问题] - [影响]
   - **根因:** 详细的根因分析
   - **修复方案:** 具体的代码修改步骤
   - **涉及文件:** 完整文件路径列表
   - **验证命令:** curl/bash 验证命令

### Medium
...

### Low
...

## 执行计划

### Phase 1: 紧急修复 (Critical)
- [ ] 任务 1.1: [描述]
  - 文件: [完整路径]
  - 修改: [具体代码变更]
  - 验证: [验证命令]

### Phase 2: 功能对齐 (Medium)
- [ ] 任务 2.1: ...

### Phase 3: 优化改进 (Low)
- [ ] 任务 3.1: ...

## 验证步骤

每个修复完成后：
1. 执行验证命令确认修复
2. 使用 /log-analytics-recheck 进行完整复查
3. 对比日志结构确认改进

---

计划必须足够详细，让执行者（可能是另一个 agent）无需额外上下文即可完成修复。
```

---

## Phase 5: 执行修复 (superpowers:execute-plan)

**调用 Skill 工具：**

```
skill: superpowers:execute-plan
args: server-game/docs/plans/{Phase 0 生成的文档名}
```

**execute-plan 将：**
1. 加载 Phase 4 生成的计划文档
2. 按优先级批次执行任务
3. 每个批次完成后报告进度
4. 使用 superpowers:verification-before-completion 验证
5. 遇到问题使用 superpowers:systematic-debugging 处理

---

## 完整执行示例

```
用户: /log-analytics

Claude: 开始游戏日志分析流程...

[Phase 0] 调用 Haiku Agent 准备环境
→ 清理旧日志完成
→ 生成文档名：2026-01-31-002-log-analysis.md

[Phase 1] 调用 Sonnet Agent 下载日志
→ 12 个游戏日志下载完成
→ 成功: 11, 失败: 1 (Anubis 服务未启动)

[Phase 2] 调用 Sonnet Agent 差异分析
→ 发现 5 个游戏存在字段缺失
→ 发现 2 个游戏 RTP 控制异常

[Phase 3] 调用 Opus Agent 深度分析
→ Critical: 2 个问题
→ Medium: 4 个问题
→ Low: 3 个问题

[Phase 4] 调用 superpowers:writing-plans
→ 生成执行计划：server-game/docs/plans/2026-01-31-002-log-analysis.md

[Phase 5] 调用 superpowers:execute-plan
→ 批次 1/3: Critical 修复完成
→ 批次 2/3: Medium 修复完成
→ 批次 3/3: Low 修复完成

分析修复完成！使用 /log-analytics-recheck 进行复查验证。
```

---

## 快速参考

| Phase | 工具 | 模型/技能 | 输出 |
|-------|------|-----------|------|
| 0 | Task | haiku | 文档名、清理旧日志 |
| 1 | Task | sonnet | logjson/ 文件 |
| 2 | Task | sonnet | 差异表格 |
| 3 | Task | opus | 问题分类列表 |
| 4 | Skill | superpowers:writing-plans | 版本化执行计划 |
| 5 | Skill | superpowers:execute-plan | 代码修改 |

---

## 历史文档管理

### 查看历史分析

```bash
# 列出所有分析文档
ls -la server-game/docs/plans/*-log-analysis.md

# 按日期筛选
ls server-game/docs/plans/2026-01-31-*-log-analysis.md
```

### 对比历史版本

```bash
# 对比两次分析结果
diff server-game/docs/plans/2026-01-31-001-log-analysis.md \
     server-game/docs/plans/2026-01-31-002-log-analysis.md
```

---

## 相关技能

- **log-analytics-recheck** - 复查分析（不下载日志）
- **superpowers:writing-plans** - 生成详细执行计划
- **superpowers:execute-plan** - 批次执行修复计划
- **superpowers:systematic-debugging** - 调试复杂问题
- **superpowers:verification-before-completion** - 验证修复完成

---

## 常见问题

### Q: 同一天执行多次会覆盖文档吗？

A: 不会。每次执行都会生成唯一的序号（001, 002, 003...），历史文档全部保留。

### Q: Phase 失败后如何恢复？

A: 可以手动从失败的 Phase 开始重新执行，或重新运行完整流程。

### Q: 修复后如何验证？

A: 使用 `/log-analytics-recheck` 技能进行复查分析，对比修复前后的变化。
