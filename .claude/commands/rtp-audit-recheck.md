# 通用 RTP 审计复查 /rtp-audit-recheck

**多轮迭代复查** - 当 rtp-audit 的自动修复未完全解决问题时，用户手动修复后调用此技能进行再次验证。

支持所有 12 个 Unity 游戏服务，通过游戏注册表 (`game-registry.md`) 自动加载配置。

## 参数

| 参数形式 | 示例 | 说明 |
|----------|------|------|
| 无参数 | `/rtp-audit-recheck` | 默认使用 mj2 (Mahjong Ways 2) |
| gameId | `/rtp-audit-recheck mj2` | 指定游戏 ID |
| game=xxx | `/rtp-audit-recheck game=ft` | 指定游戏 ID |

## 设计原则

1. **全 Agent 执行** - 所有 Phase 通过 Task 工具调用 agent
2. **支持重复执行** - 每次执行生成唯一文档，不覆盖历史
3. **完全重新模拟** - 不使用历史数据，重新执行模拟获取新数据
4. **多轮对比分析** - 与上次审计和所有历史复查结果对比
5. **趋势分析** - 展示多轮复查的改善趋势
6. **自动服务管理** - 自动停止/启动服务，无需人工干预
7. **全量清理** - 使用 purge-all 彻底清空数据库和 Redis

## 适用场景

| 场景 | 说明 |
|------|------|
| 修复验证 | 手动修复后，验证问题是否解决 |
| 迭代调优 | 多次调整配置后，追踪改善趋势 |
| 回归测试 | 代码变更后，检查是否引入新问题 |
| 深度验证 | 首次审计修复后，进行更严格的验证 |

## 工作流程

```
Phase 0: 环境准备 (Haiku Agent)
    - 停止服务 (taskkill by port)
    - 启动服务 (mvn spring-boot:run 后台)
    - 等待健康检查通过
    - purge-all 全量清理
    - 确定复查序号 (recheck-N)
    ↓
Phase 1: 执行模拟 (Sonnet Agent)
    ↓
Phase 2: 数据采集 (Sonnet Agent)
    - 数据导出到 logjson/recheck-{N}/
    ↓
Phase 3: 深度分析 (Opus Agent)
    ↓
Phase 4: 迭代对比分析 (Opus Agent)
    - 与上次审计(rtp-audit)结果对比
    - 与上次复查(recheck-{N-1})结果对比
    - 趋势分析
    ↓
Phase 5: 生成复查报告 (superpowers:writing-plans)
    - 迭代对比报告
```

---

## 服务管理函数

### stopService(port)
通过端口查找并终止 Java 进程（Windows）：
```bash
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :{port} ^| findstr LISTENING') do taskkill /F /PID %%p
sleep 2
```

### startService(serviceName, port, pathPrefix)
后台启动服务并等待健康检查：
```bash
cd server-game/{serviceName}
mvn spring-boot:run  # 使用 Bash tool 的 run_in_background: true

# 健康检查轮询（最多 60 秒，每 2 秒检查一次）
for i in {1..30}; do
  response=$(curl -s http://localhost:{port}/{pathPrefix}/admin/system/info)
  if [ $? -eq 0 ] && echo "$response" | grep -q '"status"'; then
    echo "服务已就绪"
    break
  fi
  sleep 2
done
```

### purgeAll(port, pathPrefix)
调用 purge-all 彻底清空数据库和 Redis：
```bash
curl -X POST "http://localhost:{port}/{pathPrefix}/admin/cleanup/purge-all" \
  -H "Content-Type: application/json" \
  -d '{"confirmation": "CONFIRM_PURGE_ALL", "operator": "rtp-audit-recheck"}'
```

---

## 参数解析与配置加载

**执行步骤：**

1. **解析用户输入的游戏参数**
   - 无参数时，默认使用 `mj2`
   - 支持 gameId（如 `mj2`, `ft`, `goo`）
   - 支持 game=xxx 格式

2. **读取游戏注册表**
   - 路径：`.claude/commands/game-registry.md`
   - 提取游戏配置表

3. **匹配并加载配置**
   - 根据 gameId 查找匹配的游戏
   - 提取以下配置变量：
     - `{gameId}` - 游戏标识（如 mj2, ft, goo）
     - `{gameName}` - 游戏名称（如 Mahjong Ways 2）
     - `{port}` - 服务端口（如 8082, 8084, 8089）
     - `{pathPrefix}` - API 路径前缀（如 mahjong2, fortuneTiger）
     - `{database}` - 数据库名（如 mj2_db, ft_db）
     - `{gameType}` - 游戏类型（Ways, LinePay, Tumble）
     - `{serviceName}` - 服务目录名

4. **设置输出目录**
   - 输出目录：`_bmad-output/rtp-audit/{gameId}/`
   - 日志目录：`_bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/`

5. **验证配置**
   - 如果游戏未找到，返回错误并列出可用游戏
   - 确认端口和路径前缀正确

---

## Phase 0: 环境准备 (Haiku Agent)

**使用 Task 工具，model=haiku：**

```
准备 {gameName} ({gameId}) 复查环境：

## 游戏配置
- gameId: {gameId}
- gameName: {gameName}
- port: {port}
- pathPrefix: {pathPrefix}
- gameType: {gameType}
- serviceName: {serviceName}

## 1. 停止现有服务（如有）
通过端口查找并终止进程：
```bash
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :{port} ^| findstr LISTENING') do taskkill /F /PID %%p
```
等待 2 秒确保进程完全停止

## 2. 启动服务（后台）
使用 Bash tool 的 run_in_background: true：
```bash
cd server-game/{serviceName}
mvn spring-boot:run
```

## 3. 健康检查轮询（最多 60 秒）
每 2 秒检查一次：
```bash
curl -s http://localhost:{port}/{pathPrefix}/admin/system/info
```
- 如果 60 秒内未启动成功，返回错误并终止流程

## 4. purge-all 全量清理
服务启动后立即执行彻底清理：
```bash
curl -X POST "http://localhost:{port}/{pathPrefix}/admin/cleanup/purge-all" \
  -H "Content-Type: application/json" \
  -d '{"confirmation": "CONFIRM_PURGE_ALL", "operator": "rtp-audit-recheck"}'
```
- 验证返回 code=200 且 success=true
- 如果失败，重试 1 次，仍失败则终止流程

## 5. 确定复查序号
- 检查 _bmad-output/rtp-audit/{gameId}/logjson/ 目录
- 找到已存在的 recheck-* 目录，确定下一个序号
- 如：已有 recheck-1, recheck-2，则本次为 recheck-3
- 如果没有 recheck-*，则本次为 recheck-1

## 6. 创建输出目录
```bash
mkdir -p _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}
```

## 7. 生成复查文档名
- 查找 _bmad-output/rtp-audit/{gameId}/ 目录下今天的复查文档
- 格式：YYYY-MM-DD-XXX-rtp-audit-recheck-{N}.md
- 如果今天已有 001-recheck-1，下一个就是 002-recheck-2

## 8. 查找历史审计/复查文档
- 查找最近的原始审计文档：*-rtp-audit.md（不含 recheck）
- 查找最近的复查文档：*-rtp-audit-recheck-*.md
- 返回文档名和路径列表

返回结果：
- 游戏信息：{gameId} ({gameName}) - {gameType}
- 服务启动状态
- 健康检查状态
- purge-all 清理结果
- 复查序号：recheck-{N}
- 复查文档名：2026-02-04-002-rtp-audit-recheck-2.md
- 关联原始审计：2026-02-04-001-rtp-audit.md
- 历史复查文档列表（如有）
```

---

## Phase 1: 执行模拟 (Sonnet Agent)

**使用 Task 工具，model=sonnet：**

与 rtp-audit 的 Phase 1 相同，执行 RTP 模拟测试。

```
执行 {gameName} RTP 复查模拟测试：

## 游戏配置
- port: {port}
- pathPrefix: {pathPrefix}
- gameType: {gameType}

## 超时计算公式
timeout_seconds = (rounds / speed) * 2 + 30
- mode=1: speed=100
- mode=3: speed=50

## 执行模拟（使用与原始审计相同的参数）

curl -X POST http://localhost:{port}/{pathPrefix}/admin/simulate/unified \
  -H "Content-Type: application/json" \
  --max-time {计算的超时} \
  -d '{
    "mode": 3,
    "rounds": 2000,
    "betSize": 100,
    "betLevel": 1,
    "seed": {新seed},
    "playerId": "audit_player_001"
  }'

## 返回结果
- 模拟模式
- 请求轮次 vs 实际完成轮次
- actualRtp（模拟返回的 RTP）
- seed（用于复现）
- 执行时间
```

---

## Phase 2: 数据采集 (Sonnet Agent)

**使用 Task 工具，model=sonnet：**

```
采集 {gameName} 复查模拟产生的数据：

## 游戏配置
- gameId: {gameId}
- port: {port}
- pathPrefix: {pathPrefix}
- 输出目录: _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/

## 前置：日志等待机制

从 Phase 1 获取 EXPECTED_COUNT = spinCount

轮询等待日志写入完成（最多 30 秒）：
```bash
for i in {1..6}; do
  ACTUAL=$(curl -s http://localhost:{port}/{pathPrefix}/admin/control-log/stats/overview | jq '.data.totalLogs // 0')
  echo "等待日志写入: $ACTUAL / $EXPECTED_COUNT"
  if [ "$ACTUAL" -ge "$EXPECTED_COUNT" ]; then
    break
  fi
  sleep 5
done
```

## 数据采集（导出到 recheck-{N}/ 目录）

1. 控制日志（核心数据）：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/export" > _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/{gameId}-control-log.json

2. 统计概览：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/stats/overview" > _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/stats-overview.json

3. 按控制模式统计：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/stats/by-mode" > _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/stats-by-mode.json

4. 按结果统计：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/stats/by-result" > _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/stats-by-result.json

5. 全局 RTP 统计：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/rtp/global" > _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/global-rtp.json

6. 诊断信息：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/diagnostics/failure-stats?hours=24" > _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/failure-stats.json

## 返回结果
- 游戏：{gameId} ({gameName})
- 复查序号：recheck-{N}
- 日志等待结果（预期 vs 实际）
- 各文件采集状态
- 文件路径清单
```

---

## Phase 3: 深度分析 (Opus Agent)

**使用 Task 工具，model=opus：**

与 rtp-audit 的 Phase 3 相同，执行 RTP/健康度深度分析。

```
基于 Phase 2 采集的数据进行 {gameName} RTP/健康度深度分析：

## 游戏配置
- gameId: {gameId}
- gameName: {gameName}
- gameType: {gameType}
- 数据目录: _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/

## 读取数据文件
读取 recheck-{N}/ 目录下的所有 JSON 文件

## 分析逻辑
与 rtp-audit Phase 3 相同：
- 通用 RTP 判定指标
- FRTPG 指标（仅 Ways/Tumble）
- 健康度判定分析
- 问题分类决策树

## 输出格式
- 问题列表（Critical/Medium/Low）
- 指标汇总表
- 可复现投注列表
- 问题数量统计

返回完整的分析结果，供 Phase 4 对比使用。
```

---

## Phase 4: 迭代对比分析 (Opus Agent)

**使用 Task 工具，model=opus：**

```
执行 {gameName} 多轮迭代对比分析：

## 游戏配置
- gameId: {gameId}
- gameName: {gameName}
- gameType: {gameType}

## 数据位置
- 原始审计(before): _bmad-output/rtp-audit/{gameId}/logjson/before/
- 修复后(after): _bmad-output/rtp-audit/{gameId}/logjson/after/ (如有)
- 上次复查(recheck-{N-1}): _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N-1}/ (如有)
- 本次复查(recheck-{N}): _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/

## 历史审计文档
{Phase 0 返回的历史文档列表}

## 本次分析结果
{Phase 3 返回的分析结果}

## 对比维度

### 1. 复查历史时间线

读取所有历史审计和复查报告，构建时间线：

| 次数 | 时间 | 类型 | RTP | 问题数 | 状态 |
|------|------|------|-----|--------|------|
| 首次审计 | 2026-02-04 10:00 | audit | 98.5% | C:0 M:2 L:1 | 已修复 |
| 复查 1 | 2026-02-04 11:30 | recheck-1 | 96.8% | C:0 M:1 L:1 | 部分修复 |
| 本次 | 2026-02-04 14:00 | recheck-{N} | 96.2% | C:0 M:0 L:1 | ... |

### 2. 关键指标变化趋势

| 指标 | 首次审计 | 修复后 | 复查1 | ... | 本次 | 趋势 |
|------|----------|--------|-------|-----|------|------|
| 整体 RTP | 98.5% | 96.2% | 96.8% | ... | 96.2% | ↘ 稳定 |
| 控制触发率 | 25% | 45% | 48% | ... | 50% | ↗ 改善 |
| FRTPG 拦截率 | 3% | 12% | 15% | ... | 18% | ↗ 改善 |
| 控制失败率 | 15% | 5% | 4% | ... | 3% | ↘ 改善 |

### 3. 问题修复追踪

| 问题ID | 问题描述 | 首次审计 | 修复后 | 复查1 | ... | 本次 |
|--------|----------|----------|--------|-------|-----|------|
| M1 | RTP 超标 | FAIL | PASS | PASS | ... | PASS |
| M2 | 控制率低 | FAIL | FAIL | PASS | ... | PASS |
| L1 | SUPPRESS偏高 | WARN | WARN | WARN | ... | PASS |

### 4. 与上次对比

#### vs 上次复查 (recheck-{N-1})
| 指标 | 上次 | 本次 | 变化 | 评估 |
|------|------|------|------|------|
| 整体 RTP | X% | Y% | +/-Z% | 改善/恶化 |
| ... | ... | ... | ... | ... |

#### vs 原始审计
| 指标 | 原始 | 本次 | 总变化 | 评估 |
|------|------|------|--------|------|
| 整体 RTP | X% | Y% | +/-Z% | 改善/恶化 |
| ... | ... | ... | ... | ... |

### 5. 趋势分析

#### 改善趋势
- RTP 从 98.5% 降至 96.2%（改善 2.3%）
- 控制触发率从 25% 升至 50%（改善 25%）

#### 需关注
- SUPPRESS 触发率持续在边界（49%）

#### 回归风险
- 无新问题引入 / 发现新问题 [列表]

### 6. 修复效果评估

```
原始问题总数: X
├── 已修复: Y (Z%)
├── 部分修复: A
├── 未修复: B
└── 新发现: C

修复进度: ████████░░ 80%
趋势评估: 持续改善 / 稳定 / 需关注
```

## 输出

### 迭代对比摘要
- 复查次数：第 {N} 次
- 与上次变化：改善/持平/恶化
- 与原始审计变化：改善/持平/恶化
- 整体趋势：持续改善 / 趋于稳定 / 需关注

### 下一步建议
1. [如有未修复问题] 继续修复 [具体问题]
2. [如趋于稳定] 可以结束复查，转入监控
3. [如有新问题] 调查新发现的问题 [具体问题]
```

---

## Phase 5: 生成复查报告 (superpowers:writing-plans)

**调用 Skill 工具：**

```
skill: superpowers:writing-plans
args: 根据 {gameName} 复查分析结果生成迭代复查报告
```

**传递给 writing-plans 的上下文：**

```
基于 {gameName} ({gameId}) RTP 审计复查分析结果，生成详细的迭代复查报告。

## 游戏配置
- gameId: {gameId}
- gameName: {gameName}
- gameType: {gameType}
- port: {port}
- pathPrefix: {pathPrefix}

## 文档信息
- 文档名：{Phase 0 生成的复查文档名}
- 路径：_bmad-output/rtp-audit/{gameId}/{文档名}
- 复查序号：recheck-{N}
- 关联原始审计：{原始审计文档}
- 历史复查：[{历史复查文档列表}]

## 复查结果
{Phase 3 和 Phase 4 的输出}

## 报告格式要求

# {gameName} RTP 审计复查报告 - 第{N}次 - [日期]

## 元信息
| 属性 | 值 |
|------|-----|
| 游戏 | {gameName} ({gameId}) |
| 游戏类型 | {gameType} |
| 复查时间 | [ISO 时间戳] |
| 复查序号 | 第 {N} 次 |
| 关联原审计 | [链接] |
| 上次复查 | [链接] (如有) |
| 模拟轮次 | [rounds] |
| 使用 Seed | [seed] |

## 复查历史

### 时间线
| 次数 | 时间 | RTP | 问题数 | 状态 |
|------|------|-----|--------|------|
| 首次审计 | ... | X% | N | 已修复 |
| 复查 1 | ... | Y% | M | 部分修复 |
| ... | ... | ... | ... | ... |
| **本次** | ... | Z% | K | ... |

### 趋势图（ASCII）
```
RTP 变化趋势:
98% |*
97% |  *
96% |    * * *
95% |
    +---------> 时间
     首  修  复  复  本
     次  复  查  查  次
         后  1   2
```

## 当前健康度

### 仪表盘
```
整体评估: [优秀/良好/需关注/异常]

RTP 控制:     [██████████] 96% ✓
玩家体验:     [███████░░░] 70% ⚠
数据完整性:   [██████████] 100% ✓
{如果是 Ways/Tumble 类游戏}
FRTPG 防线:   [████████░░] 80% ✓
```

### 指标对比
| 指标 | 首次审计 | 上次复查 | 本次 | 变化趋势 |
|------|----------|----------|------|----------|
| 整体 RTP | X% | Y% | Z% | ↘ 稳定 |
| 控制触发率 | X% | Y% | Z% | ↗ 改善 |
| ... | ... | ... | ... | ... |

## 问题追踪

### 修复进度
```
原始问题: X
├── 已修复: Y ████████░░ (80%)
├── 部分修复: A ██░░░░░░░░ (10%)
├── 未修复: B ░░░░░░░░░░ (5%)
└── 新发现: C █░░░░░░░░░ (5%)
```

### 问题状态详情

| 问题ID | 问题 | 首次 | 上次 | 本次 | 变化 |
|--------|------|------|------|------|------|
| M1 | RTP超标 | FAIL | PASS | PASS | ✓ 已修复 |
| M2 | 控制率低 | FAIL | FAIL | PASS | ✓ 本次修复 |
| L1 | SUPPRESS偏高 | WARN | WARN | WARN | - 持续 |
| N1 | [新问题] | - | - | FAIL | ⚠ 新发现 |

### 本次新发现问题（如有）
- [N1] **问题标题**
  - **现象**：...
  - **指标**：...
  - **建议**：...

### 仍待修复问题（如有）
- [L1] **问题标题**
  - **当前状态**：...
  - **阻塞原因**：...
  - **建议**：...

## 对比分析

### vs 原始审计
| 维度 | 原始 | 本次 | 变化 | 评估 |
|------|------|------|------|------|
| 问题总数 | X | Y | -Z | 改善 |
| 整体 RTP | X% | Y% | -Z% | 改善 |
| 控制效果 | 差 | 良 | ↑ | 改善 |

### vs 上次复查
| 维度 | 上次 | 本次 | 变化 | 评估 |
|------|------|------|------|------|
| 问题总数 | X | Y | -Z | 改善 |
| 整体 RTP | X% | Y% | +Z% | 恶化/改善 |

## 结论与建议

### 整体评估
[优秀/良好/需继续改进]

### 下一步建议
1. [建议1]
2. [建议2]
3. [建议3]

### 后续操作
```bash
# 继续复查（如有需要）
/rtp-audit-recheck {gameId}

# 重新完整审计（如需重新基线）
/rtp-audit {gameId}
```

## 附件

- _bmad-output/rtp-audit/{gameId}/logjson/recheck-{N}/ - 本次复查数据
- _bmad-output/rtp-audit/{gameId}/logjson/before/ - 原始审计数据
- _bmad-output/rtp-audit/{gameId}/logjson/after/ - 修复后数据（如有）

---

如果所有原始问题都已修复且无新问题，明确标注"复查通过，所有问题已解决，审计流程完成"。
如果存在遗留问题，明确标注"第 {N} 次复查完成，仍有 X 个问题待解决"。
如果发现新问题，明确标注"发现 X 个新问题，建议继续调查"。
```

---

## 目录结构

```
_bmad-output/rtp-audit/{gameId}/
├── {date}-{seq}-rtp-audit.md               # 首次审计报告
├── {date}-{seq}-rtp-audit-recheck-1.md     # 第1次复查
├── {date}-{seq}-rtp-audit-recheck-2.md     # 第2次复查
├── {date}-{seq}-rtp-audit-recheck-3.md     # 第3次复查
├── logjson/
│   ├── before/                             # 首次审计数据
│   ├── after/                              # 修复后数据（如有）
│   ├── recheck-1/                          # 第1次复查数据
│   ├── recheck-2/                          # 第2次复查数据
│   └── recheck-3/                          # 第3次复查数据
└── plans/
    └── rtp-fix-plan-{timestamp}.md         # 修复计划
```

---

## 完整执行示例

```
用户: /rtp-audit-recheck ft

Claude: 开始 Fortune Tiger (ft) RTP 审计复查（第 2 次）...

[配置加载] 从 game-registry.md 获取配置
→ gameId: ft
→ gameName: Fortune Tiger
→ port: 8084
→ pathPrefix: fortuneTiger
→ gameType: LinePay

[Phase 0] 调用 Haiku Agent 准备环境
→ 停止现有服务：完成
→ 启动服务：成功（耗时 25s）
→ 健康检查：通过
→ purge-all 清理：数据库 3000 条，Redis 89 个 key
→ 复查序号：recheck-2
→ 关联原审计：2026-02-04-001-rtp-audit.md
→ 上次复查：2026-02-04-002-rtp-audit-recheck-1.md
→ 复查文档名：2026-02-04-003-rtp-audit-recheck-2.md

[Phase 1] 调用 Sonnet Agent 执行模拟
→ 模式：3（带控制）
→ 轮次：2000
→ Seed：20260204003
→ actualRtp：96.2%
→ 执行时间：92 秒

[Phase 2] 调用 Sonnet Agent 采集数据
→ 等待日志写入：2000/2000
→ 数据导出到：logjson/recheck-2/
→ 控制日志：导出完成（2000 条）

[Phase 3] 调用 Opus Agent 深度分析
→ 游戏类型：LinePay（跳过 FRTPG 检查）
→ 通用指标：4/4 PASS
→ 问题发现：Critical 0, Medium 0, Low 1

[Phase 4] 调用 Opus Agent 迭代对比分析
→ 复查历史：
   - 首次审计：RTP 98.5%, 问题 C:0 M:2 L:1
   - 修复后：RTP 96.2%, 问题 C:0 M:0 L:1
   - 复查 1：RTP 96.5%, 问题 C:0 M:0 L:1
   - 本次：RTP 96.2%, 问题 C:0 M:0 L:1
→ 趋势评估：稳定
→ vs 上次复查：RTP -0.3% (在合理波动范围内)
→ vs 原始审计：问题减少 2 个，RTP 降低 2.3%

[Phase 5] 调用 superpowers:writing-plans
→ 生成报告：_bmad-output/rtp-audit/ft/2026-02-04-003-rtp-audit-recheck-2.md

复查完成！第 2 次复查结果：
- 整体评估：良好
- Critical: 0
- Medium: 0 (已全部修复)
- Low: 1 (SUPPRESS 触发率边界)
- 趋势：稳定，可结束复查

建议：RTP 控制已稳定在目标范围，可转入日常监控。
如需继续复查，使用 /rtp-audit-recheck game=ft
```

---

## 快速参考

| Phase | 工具 | 模型/技能 | 输出 |
|-------|------|-----------|------|
| 0 | Task | haiku | 环境准备、服务启动、purge-all、复查序号 |
| 1 | Task | sonnet | 模拟结果 |
| 2 | Task | sonnet | logjson/recheck-{N}/ |
| 3 | Task | opus | 问题分类列表 |
| 4 | Task | opus | 迭代对比分析 |
| 5 | Skill | superpowers:writing-plans | 迭代复查报告 |

---

## 支持的游戏列表

| gameId | gameName | port | gameType |
|--------|----------|------|----------|
| mj2 | Mahjong Ways 2 | 8082 | Ways |
| mj1 | Mahjong Ways 1 | 8083 | Ways |
| ft | Fortune Tiger | 8084 | LinePay |
| fg | Fortune Gems | 8085 | LinePay |
| fg2 | Fortune Gems 2 | 8086 | LinePay |
| fr | Fortune Rabbit | 8087 | LinePay |
| fo | Fortune Ox | 8088 | LinePay |
| goo | Gates of Olympus | 8089 | Tumble |
| sb | Sweet Bonanza | 8090 | Tumble |
| sp | Starlight Princess | 8091 | Tumble |
| gog | Gates of Gatot | 8092 | Tumble |
| anubis | Anubis | 8093 | Ways |

详细配置请参考：`.claude/commands/game-registry.md`

---

## 游戏类型差异

| gameType | FRTPG | 分析重点 |
|----------|-------|----------|
| Ways | ✓ 有 | FRTPG 拦截率、级联消除效果 |
| Tumble | ✓ 有 | FRTPG 拦截率、Tumble 机制效果 |
| LinePay | ✗ 无 | 控制效率、固定线赔付准确性 |

---

## 与 rtp-audit 的关系

| 维度 | rtp-audit | rtp-audit-recheck |
|------|-----------|-------------------|
| 服务重启 | ✓ 是 | ✓ 是 |
| purge-all 清理 | ✓ 是 | ✓ 是 |
| 执行模拟 | ✓ 是 | ✓ 是 |
| 自动修复 | ✓ 是 | ✗ 否 |
| 复查验证 | ✓ 是（修复后） | ✓ 是（主要功能） |
| 多轮对比 | ✗ 否 | ✓ 是 |
| 趋势分析 | ✗ 否 | ✓ 是 |
| 适用场景 | 首次完整审计 | 手动修复后验证 |

**典型工作流：**

```
1. /rtp-audit ft           → 首次完整审计 + 自动修复
2. [如自动修复不完整] 手动修复
3. /rtp-audit-recheck ft   → 第 1 次复查验证
4. [如仍有问题] 手动修复
5. /rtp-audit-recheck ft   → 第 2 次复查验证
6. [重复直到所有问题解决]
7. 转入日常监控
```

---

## 常见问题

### Q: rtp-audit-recheck 和 rtp-audit 的主要区别是什么？

A:
- **rtp-audit**：完整闭环流程，包含自动修复。适用于首次审计或需要自动修复的场景。
- **rtp-audit-recheck**：仅复查验证，不执行自动修复。适用于手动修复后的验证，支持多轮迭代对比。

### Q: 复查会使用历史数据吗？

A: 不会。每次复查都会重启服务、purge-all 清理数据库、重新执行模拟，获取全新数据。历史数据仅用于对比分析。

### Q: 可以跳过服务重启吗？

A: 不可以。为确保测试环境干净，服务重启和 purge-all 清理是强制步骤。

### Q: 复查报告会包含哪些历史信息？

A: 复查报告会包含：
- 首次审计结果
- 所有历史复查结果
- 关键指标的变化趋势
- 问题修复追踪时间线

### Q: 如何知道是否可以结束复查？

A: 当满足以下条件时可以结束复查：
- 所有 Critical 和 Medium 问题已修复
- 连续 2+ 次复查指标稳定
- 无新问题发现

### Q: 复查序号是如何确定的？

A: 系统会自动检查 `logjson/` 目录下的 `recheck-*` 目录，确定下一个序号。如已有 `recheck-1` 和 `recheck-2`，下次复查将为 `recheck-3`。

---

## 相关技能

- **rtp-audit** - 完整审计（含自动修复）
- **game-registry** - 游戏注册表配置
- **log-analytics** - 完整游戏日志分析
- **superpowers:writing-plans** - 生成详细执行计划
- **superpowers:systematic-debugging** - 调试复杂问题
