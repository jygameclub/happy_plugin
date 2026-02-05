# 通用 RTP/健康度自动审计 /rtp-audit

多 Agent 协作执行 RTP 审计，支持所有 12 个 Unity 游戏服务。

**完整闭环流程：首次审计 → 自动修复 → 复查验证**

## 参数解析

**游戏选择参数：**
- `/rtp-audit` → 使用默认游戏 mj2 (Mahjong Ways 2)
- `/rtp-audit game=ft` → 审计 Fortune Tiger
- `/rtp-audit ft` → 审计 Fortune Tiger（简写）

**其他参数：**
- `mode`: 1（纯引擎）或 3（带控制），默认 3
- `rounds`: 200-5000，默认 2000
- `betSize`: 下注金额，默认 100
- `betLevel`: 下注等级，默认 1
- `seed`: 随机种子，默认 当前日期+序号
- `playerId`: 模式 3 必需，默认 "audit_player_001"

**示例：**
```
/rtp-audit game=goo mode=1 rounds=5000
/rtp-audit ft rounds=1000
```

## 游戏配置加载

执行前必须加载游戏配置：

1. 读取 `.claude/commands/game-registry.md` 获取游戏注册表
2. 根据 gameId 提取配置变量：
   - `{gameId}`: 游戏简称 (如 ft, mj2, goo)
   - `{gameName}`: 游戏全名 (如 Fortune Tiger)
   - `{port}`: 服务端口 (如 8084)
   - `{pathPrefix}`: API 路径前缀 (如 fortuneTiger)
   - `{gameType}`: 游戏类型 (Ways/LinePay/Tumble)
   - `{serviceName}`: 服务目录名 (如 fortunetiger-service)

3. 验证 gameId 存在于注册表，否则显示错误：
   ```
   错误：无效的游戏 ID "{input}"

   可用游戏：
   - mj2 (Mahjong Ways 2) - Ways
   - mj1 (Mahjong Ways 1) - Ways
   - ft (Fortune Tiger) - LinePay
   - fg (Fortune Gems) - LinePay
   - fg2 (Fortune Gems 2) - LinePay
   - fr (Fortune Rabbit) - LinePay
   - fo (Fortune Ox) - LinePay
   - goo (Gates of Olympus) - Tumble
   - sb (Sweet Bonanza) - Tumble
   - sp (Starlight Princess) - Tumble
   - gog (Gates of Gatot) - Tumble
   - anubis (Anubis) - Ways
   ```

---

## 设计原则

1. **全 Agent 执行** - 所有 Phase 通过 Task 工具调用 agent
2. **支持重复执行** - 每次执行生成唯一文档，不覆盖历史
3. **多游戏支持** - 通过游戏注册表配置支持 12 个 Unity 游戏
4. **游戏类型感知** - 根据 gameType 调整分析指标
5. **文档版本化** - 使用时间戳+序号命名，按游戏分目录
6. **Seed 可追溯** - 支持复现任意投注
7. **自动服务管理** - 自动停止/启动服务，无需人工干预
8. **全量清理** - 使用 purge-all 彻底清空数据库和 Redis
9. **自动修复闭环** - 发现问题后自动生成修复计划并执行

## 审计模式说明

| 模式 | 名称 | API 参数 | 用途 | 速度 |
|------|------|----------|------|------|
| 1 | 纯引擎 RTP 验证 | `mode=1` | 验证底层数学模型，无控制日志 | ~100 轮/秒 |
| 3 | 带控制模拟 | `mode=3, playerId=*` | 验证 RTP 控制逻辑，写控制日志 | ~50 轮/秒 |
| C | 真实投注 | 循环调用 `/bet` | 完整链路验证，扣余额 | ~10 轮/秒 |

## 工作流程

```
Phase 0: 环境准备 (Haiku Agent)
    - 停止服务 (taskkill by port)
    - 启动服务 (mvn spring-boot:run 后台)
    - 等待健康检查通过
    - purge-all 全量清理
    ↓
Phase 1: 执行模拟 (Sonnet Agent)
    ↓
Phase 2: 数据采集 (Sonnet Agent)
    - 数据导出到 logjson/before/
    ↓
Phase 3: 深度分析 (Opus Agent)
    ↓
[条件分支] 发现 Critical/Medium 问题？
    ↓ 是
Phase 4: 自动修复 (Opus Agent)
    - 停止服务
    - superpowers:writing-plans 生成修复计划
    - superpowers:executing-plans 执行修复
    ↓
Phase 5: 复查验证 (Sonnet + Opus Agent)
    - 启动服务
    - purge-all 全量清理
    - 执行模拟（新数据）
    - 数据导出到 logjson/after/
    - 对比分析
    ↓
Phase 6: 生成报告 (superpowers:writing-plans)
    - 修复前/后对比报告
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
  -d '{"confirmation": "CONFIRM_PURGE_ALL", "operator": "rtp-audit"}'
```

**清理范围：**

| 类型 | 内容 |
|------|------|
| 数据库 | t_bet_detail, t_bet_master, t_control_log, t_risk_alerts, t_player_rtp_stats, t_global_rtp_stats |
| Redis | {prefix}:session:*, {prefix}:chain:*, {prefix}:lock:bet:*, {prefix}:rtp:player:*, {prefix}:rtp:global |

---

## Phase 0: 环境准备 (Haiku Agent)

**使用 Task 工具，model=haiku：**

```
准备 RTP 审计环境（{gameName} 服务，端口 {port}）：

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
- 显示启动进度（如：等待中... 10s / 60s）

## 4. purge-all 全量清理
服务启动后立即执行彻底清理：
```bash
curl -X POST "http://localhost:{port}/{pathPrefix}/admin/cleanup/purge-all" \
  -H "Content-Type: application/json" \
  -d '{"confirmation": "CONFIRM_PURGE_ALL", "operator": "rtp-audit"}'
```
- 验证返回 code=200 且 success=true
- 如果失败，重试 1 次，仍失败则终止流程

## 5. 创建输出目录
```bash
mkdir -p _bmad-output/rtp-audit/{gameId}/logjson/before
mkdir -p _bmad-output/rtp-audit/{gameId}/logjson/after
mkdir -p _bmad-output/rtp-audit/{gameId}/plans
```

## 6. 生成唯一文档名
- 查找 _bmad-output/rtp-audit/{gameId}/ 目录下今天的审计文档
- 格式：YYYY-MM-DD-XXX-rtp-audit.md（XXX 为序号 001, 002...）
- 如果今天已有 001，下一个就是 002

返回结果：
- 游戏信息：{gameId} ({gameName}) - {gameType}
- 服务启动状态
- 健康检查状态
- purge-all 清理结果（删除记录数）
- 生成的文档名（供后续 Phase 使用）
- 输出目录路径

示例输出：
- 游戏：ft (Fortune Tiger) - LinePay
- 服务状态：已启动（耗时 25s）
- 清理结果：数据库删除 12345 条，Redis 删除 206 个 key
- 文档名：2026-02-04-001-rtp-audit.md
- 完整路径：_bmad-output/rtp-audit/ft/2026-02-04-001-rtp-audit.md
```

---

## Phase 1: 执行模拟 (Sonnet Agent)

**使用 Task 工具，model=sonnet：**

```
执行 {gameName} RTP 模拟测试：

## 游戏配置
- port: {port}
- pathPrefix: {pathPrefix}
- gameType: {gameType}

## 超时计算公式
timeout_seconds = (rounds / speed) * 2 + 30
- mode=1: speed=100
- mode=3: speed=50

示例：
- 2000 轮 mode=1: (2000/100)*2+30 = 70 秒
- 2000 轮 mode=3: (2000/50)*2+30 = 110 秒

## 执行模拟

### 模式 1 或 3（使用 unified API）
curl -X POST http://localhost:{port}/{pathPrefix}/admin/simulate/unified \
  -H "Content-Type: application/json" \
  --max-time {计算的超时} \
  -d '{
    "mode": {mode},
    "rounds": {rounds},
    "betSize": {betSize},
    "betLevel": {betLevel},
    "seed": {seed},
    "playerId": "{playerId}"  // 仅 mode=3
  }'

## 错误处理

1. 503 Service Unavailable（模拟服务不可用）：
   - 显示警告："{gameName} 不支持 mode={mode} 模拟"
   - 如果 mode=1 失败，建议使用 mode=3
   - 如果都失败，终止并提示检查 IGameSimulator 实现

2. 超时：
   - 查询 /{pathPrefix}/admin/simulate/status 获取已完成轮次
   - 记录实际完成数，继续 Phase 2

3. 429 Too Many Requests：
   - 等待 30 秒后重试
   - 最多重试 3 次

4. 4xx/5xx HTTP 错误：
   - 终止流程
   - 输出诊断信息（响应体、状态码）

## 返回结果
- 游戏：{gameId} ({gameName})
- 模拟模式
- 请求轮次 vs 实际完成轮次
- actualRtp（模拟返回的 RTP）
- seed（用于复现）
- 执行时间
- 错误信息（如有）
```

---

## Phase 2: 数据采集 (Sonnet Agent)

**使用 Task 工具，model=sonnet：**

```
采集 {gameName} 模拟产生的数据（等待异步日志写入后）：

## 游戏配置
- gameId: {gameId}
- port: {port}
- pathPrefix: {pathPrefix}
- 输出目录: _bmad-output/rtp-audit/{gameId}/logjson/before/

## 前置：日志等待机制

从 Phase 1 获取 EXPECTED_COUNT = spinCount

轮询等待日志写入完成（最多 30 秒）：

for i in {1..6}; do
  ACTUAL=$(curl -s http://localhost:{port}/{pathPrefix}/admin/control-log/stats/overview | jq '.data.totalLogs // 0')
  echo "等待日志写入: $ACTUAL / $EXPECTED_COUNT"
  if [ "$ACTUAL" -ge "$EXPECTED_COUNT" ]; then
    break
  fi
  sleep 5
done

记录实际写入数与预期差异，如有差异在报告中标注。

## 数据采集（导出到 before/ 目录）

1. 控制日志（核心数据）：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/export" > _bmad-output/rtp-audit/{gameId}/logjson/before/{gameId}-control-log.json

2. 统计概览：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/stats/overview" > _bmad-output/rtp-audit/{gameId}/logjson/before/stats-overview.json

3. 按控制模式统计（BOOST/SUPPRESS/NONE）：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/stats/by-mode" > _bmad-output/rtp-audit/{gameId}/logjson/before/stats-by-mode.json

4. 按结果统计（SUCCESS/FAIL_*）：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/control-log/stats/by-result" > _bmad-output/rtp-audit/{gameId}/logjson/before/stats-by-result.json

5. 全局 RTP 统计：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/rtp/global" > _bmad-output/rtp-audit/{gameId}/logjson/before/global-rtp.json

6. 诊断信息（失败统计）：
   curl -s "http://localhost:{port}/{pathPrefix}/admin/diagnostics/failure-stats?hours=24" > _bmad-output/rtp-audit/{gameId}/logjson/before/failure-stats.json

## 错误处理

- 导出失败：输出空 JSON `{}`，标记该数据缺失
- 部分导出：使用已获取数据继续，标记不完整

## 返回结果
- 游戏：{gameId} ({gameName})
- 日志等待结果（预期 vs 实际）
- 各文件采集状态
- 文件路径清单
- 数据完整性评估
```

---

## Phase 3: 深度分析 (Opus Agent)

**使用 Task 工具，model=opus：**

```
基于 Phase 2 采集的数据进行 {gameName} RTP/健康度深度分析：

## 游戏配置
- gameId: {gameId}
- gameName: {gameName}
- gameType: {gameType}
- 数据目录: _bmad-output/rtp-audit/{gameId}/logjson/before/

## 读取数据文件

读取 before/ 目录下的所有 JSON 文件：
- {gameId}-control-log.json
- stats-overview.json
- stats-by-mode.json
- stats-by-result.json
- global-rtp.json
- failure-stats.json

## 根据 gameType 调整分析逻辑

### LinePay 类游戏 (ft, fg, fg2, fr, fo)
- 跳过 FRTPG 拦截率检查（无级联机制）
- 跳过级联次数限制检查
- 跳过预计算相关分析

### Ways/Tumble 类游戏 (mj2, mj1, anubis, goo, sb, sp, gog)
- 执行完整的 FRTPG 分析
- 检查级联次数是否在合理范围
- 分析预计算效果

## 一、通用 RTP 判定指标（所有游戏）

### 1.1 整体 RTP
- 合格范围：88% ~ 98%
- 检查 global-rtp.json 中的 actualRtp
- 如果 < 88%：标记 "RTP 过低，玩家体验差"
- 如果 > 98%：标记 "RTP 超标，存在漏洞风险"

### 1.2 控制触发率
- 合格范围：30% ~ 70%
- 计算：(BOOST + SUPPRESS) / total
- 如果 < 30%：标记 "控制逻辑可能未生效"
- 如果 > 70%：标记 "控制过于频繁"

### 1.3 BOOST 触发率
- 合格范围：10% ~ 30%
- 计算：BOOST / total
- 如果 < 10%：标记 "BOOST 不足，玩家可能长输"
- 如果 > 30%：标记 "BOOST 过多，RTP 可能超标"

### 1.4 SUPPRESS 触发率
- 合格范围：20% ~ 50%
- 计算：SUPPRESS / total
- 如果 < 20%：标记 "SUPPRESS 不足，大奖风险"
- 如果 > 50%：标记 "SUPPRESS 过多，体验差"

## 二、FRTPG 指标（仅 Ways/Tumble 类游戏）

### 2.1 FRTPG 拦截率
- 合格范围：5% ~ 30%
- 计算：(CAPPED + REJECT) / total
- 如果 < 5%：标记 "FRTPG 防线可能失效"
- 如果 > 30%：标记 "FRTPG 过于激进，影响体验"

## 三、健康度判定分析（所有游戏）

### 3.1 极端输赢检测
- 阈值：winAmount/betAmount > 1000
- 告警：> 3 次/1000 spin
- 检查 control-log 中的超大赢钱记录

### 3.2 长输检测
- 阈值：连续 winAmount=0 超过 50 次
- 检查 control-log 中的连续零赢记录
- 如有，标记 "长输检测异常，补偿机制可能失效"

### 3.3 异常波动检测
- 检查 100 spin 窗口内的 RTP
- 如果 > 200% 或 < 50%，标记异常
- 统计异常窗口数量

## 四、问题分类决策树

对于每个发现的问题，按以下决策树分类：

1. IF expectedWin 与 actualWin 偏差 > 50%
   → CRITICAL: 代码 Bug（计算逻辑错误）

2. ELSE IF controlMode 应为 SUPPRESS 但为 NONE（RTP > 目标但未抑制）
   → MEDIUM: 配置问题（控制阈值配置错误）

3. ELSE IF gameType != "LinePay" AND frtpgCheckCount=0 但 RTP > 100%
   → MEDIUM: FRTPG 配置问题（未触发最终防线）

4. ELSE IF 样本量 < 1000 且偏离 < 10%
   → LOW: 合理波动（样本不足）

5. ELSE
   → LOW: 需要更多样本验证

## 五、输出格式

### 问题列表（按严重程度分类）

#### Critical（影响资金安全/游戏公平性）
- [C1] 问题描述
  - 指标：具体数值
  - 原因分析：根因判断
  - 影响：预期影响
  - 证据：相关日志字段/数值

#### Medium（影响控制效果/数据完整性）
- [M1] 问题描述
  - 指标：具体数值
  - 原因分析：根因判断
  - 影响：预期影响
  - 证据：相关日志字段/数值

#### Low（影响可观测性/可优化项）
- [L1] 问题描述
  - 指标：具体数值
  - 原因分析：根因判断
  - 影响：预期影响
  - 证据：相关日志字段/数值

### 指标汇总表

通用指标（所有游戏）：
| 指标 | 实际值 | 合格范围 | 状态 |
|------|--------|----------|------|
| 整体 RTP | X% | 88-98% | PASS/FAIL |
| 控制触发率 | X% | 30-70% | PASS/FAIL |
| BOOST 触发率 | X% | 10-30% | PASS/FAIL |
| SUPPRESS 触发率 | X% | 20-50% | PASS/FAIL |
| 极端输赢次数 | X | < 3/1000 | PASS/FAIL |
| 最长连输 | X | < 50 | PASS/FAIL |
| 异常波动窗口 | X | 0 | PASS/FAIL |

FRTPG 指标（仅 Ways/Tumble）：
| 指标 | 实际值 | 合格范围 | 状态 |
|------|--------|----------|------|
| FRTPG 拦截率 | X% | 5-30% | PASS/FAIL |

### 可复现投注列表（如有异常）
| BetId | Seed | 异常类型 | 复现命令 |
|-------|------|----------|----------|
| 123 | 20260203001 | 超大赢钱 | curl http://localhost:{port}/{pathPrefix}/admin/replay/123 |

### 是否需要修复
- needsFix: true/false
- 条件：存在 Critical 或 Medium 问题
- 问题数量统计：Critical X, Medium Y, Low Z

返回完整的分析结果，供后续阶段使用。
```

---

## Phase 4: 自动修复 (Opus Agent) - 条件执行

**条件：Phase 3 发现 Critical 或 Medium 问题时执行**

### 4.1 停止服务

```bash
# 停止服务以安全修改配置
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :{port} ^| findstr LISTENING') do taskkill /F /PID %%p
sleep 2
echo "服务已停止，开始修复..."
```

### 4.2 生成修复计划 (Opus Agent + superpowers:writing-plans)

**使用 Task 工具，model=opus：**

```
你是 RTP 控制修复专家。使用 superpowers:writing-plans 技能创建修复计划。

## 上下文
- 游戏: {gameName} ({gameId})
- 游戏类型: {gameType}
- ⚠️ 服务当前已停止，可以安全修改配置文件

## 问题列表
{Phase 3 返回的问题列表}

## 你的任务

1. **分析问题根因**，对于每个问题识别：
   - 具体配置项或代码位置
   - 需要调整的参数和方向

2. **使用 superpowers:writing-plans 创建修复计划**：
   - 文件位置：_bmad-output/rtp-audit/{gameId}/plans/rtp-fix-plan-{timestamp}.md
   - 包含：
     - 需要修改的具体文件
     - 具体参数变更 (旧值 → 新值)
     - 预期对 RTP 控制的影响
     - 验证步骤

## 配置文件位置参考
- server-game/{serviceName}/src/main/resources/config/rtp_control_global.json
- server-game/{serviceName}/src/main/resources/config/game-config.json
- game-admin-starter/src/main/java/.../FinalRtpGateChecker.java

## 输出
- 修复计划文件路径
- 计划摘要（修改项数、预期效果）
```

### 4.3 执行修复计划 (Opus Agent + superpowers:executing-plans)

**使用 Task 工具，model=opus：**

```
你是 RTP 控制修复执行者。使用 superpowers:executing-plans 技能应用修复计划。

## 服务状态
⚠️ 游戏服务当前已停止，可以安全修改配置文件，无需担心运行时冲突。

## 计划文件位置
_bmad-output/rtp-audit/{gameId}/plans/rtp-fix-plan-{timestamp}.md

## 你的任务

1. **加载计划** 使用 superpowers:executing-plans 技能

2. **执行每个任务**:
   - 编辑前先读取目标文件 (必须)
   - 应用具体变更
   - 每次变更后验证语法

3. **报告变更**:
   - 修改的文件
   - 变更的参数 (旧 → 新)
   - 遇到的任何问题

## 关键规则
- 每次只修改一处 (不批量修复)
- 编辑前必须先读取文件
- 配置变更后验证 JSON 语法
- 不修改生产代码逻辑，只修改配置参数
- 不确定时停止并报告

## 输出格式
=== 执行报告 ===
计划: rtp-fix-plan-{timestamp}.md
任务: {完成}/{总数}

任务 1: ✅ 成功
  文件: {file}
  变更: {param} {old} → {new}

整体: SUCCESS / PARTIAL / FAILED
```

---

## Phase 5: 复查验证 (Sonnet + Opus Agent) - 条件执行

**条件：Phase 4 执行了修复后执行**

### 5.1 重启服务

```bash
# 启动服务（后台）
cd server-game/{serviceName}
mvn spring-boot:run  # run_in_background: true

# 健康检查轮询（最多 60 秒）
for i in {1..30}; do
  curl -s http://localhost:{port}/{pathPrefix}/admin/system/info && break
  sleep 2
done
```

### 5.2 purge-all 全量清理

```bash
curl -X POST "http://localhost:{port}/{pathPrefix}/admin/cleanup/purge-all" \
  -H "Content-Type: application/json" \
  -d '{"confirmation": "CONFIRM_PURGE_ALL", "operator": "rtp-audit-verify"}'
```

### 5.3 执行复查模拟 (Sonnet Agent)

使用与 Phase 1 相同的参数执行模拟。

### 5.4 采集复查数据 (Sonnet Agent)

采集数据到 `logjson/after/` 目录。

### 5.5 对比分析 (Opus Agent)

```
对比 {gameName} 修复前后的数据：

## 数据位置
- 修复前: _bmad-output/rtp-audit/{gameId}/logjson/before/
- 修复后: _bmad-output/rtp-audit/{gameId}/logjson/after/

## 对比维度

### 1. 关键指标变化
| 指标 | 修复前 | 修复后 | 变化 | 评估 |
|------|--------|--------|------|------|
| 整体 RTP | X% | Y% | +/-Z% | 改善/恶化 |
| 控制触发率 | X% | Y% | +/-Z% | 改善/恶化 |
| FRTPG 拦截率 | X% | Y% | +/-Z% | 改善/恶化 |
| 控制失败率 | X% | Y% | +/-Z% | 改善/恶化 |

### 2. 问题修复验证
| 问题ID | 问题描述 | 修复前值 | 修复后值 | 状态 |
|--------|----------|----------|----------|------|
| C1 | ... | X | Y | 已修复/部分修复/未修复 |

### 3. 回归检测
- 是否引入新问题
- 是否有指标恶化

### 4. 修复效果评估
- 修复成功率：X/Y (Z%)
- 整体评估：优秀/良好/部分成功/需继续修复

## 遗留问题（如有）
- 仍需修复的问题列表
- 建议的后续操作
```

---

## Phase 6: 生成报告 (superpowers:writing-plans)

**调用 Skill 工具：**

```
skill: superpowers:writing-plans
args: 根据 RTP 审计结果生成完整报告
```

**传递给 writing-plans 的上下文：**

```
基于 {gameName} RTP 审计分析结果，生成详细的审计报告。

## 游戏信息
- gameId: {gameId}
- gameName: {gameName}
- gameType: {gameType}
- port: {port}
- pathPrefix: {pathPrefix}

## 文档信息
- 文档名：{Phase 0 生成的文档名}
- 路径：_bmad-output/rtp-audit/{gameId}/{文档名}

## 分析结果
{Phase 3 返回的完整分析结果}

## 修复信息（如已执行修复）
- 是否执行修复：是/否
- 修复计划：{计划文件路径}
- 修复结果：{Phase 4 输出}
- 复查结果：{Phase 5 输出}

## 报告格式要求

# {gameName} RTP 审计报告 - [日期] - 第[序号]次

## 元信息
| 属性 | 值 |
|------|-----|
| 游戏 | {gameName} ({gameId}) |
| 游戏类型 | {gameType} |
| 服务端口 | {port} |
| 审计时间 | [ISO 时间戳] |
| 文档版本 | [序号] |
| 审计模式 | [1/3/C] |
| 模拟轮次 | [rounds] |
| 使用 Seed | [seed] |
| 是否执行修复 | 是/否 |
| 前序文档 | [如有上次审计，列出链接] |

## 执行摘要

### 健康度仪表盘
```
整体评估: [优秀/良好/需关注/异常]

RTP 控制:     [██████████] 96% ✓
玩家体验:     [███████░░░] 70% ⚠
数据完整性:   [██████████] 100% ✓
{如果是 Ways/Tumble 类游戏}
FRTPG 防线:   [████████░░] 80% ✓
```

### 问题统计
| 级别 | 数量 | 状态 |
|------|------|------|
| Critical | X | 需立即处理 / 已修复 |
| Medium | Y | 建议修复 / 已修复 |
| Low | Z | 可优化 |

## 修复前指标（如已执行修复）
{修复前的指标表格}

## 修复后指标 / 当前指标
{当前的指标表格}

## 修复对比（如已执行修复）
| 指标 | 修复前 | 修复后 | 变化 | 评估 |
|------|--------|--------|------|------|
| ... | ... | ... | +/-X% | 改善/恶化 |

## 问题发现与修复

### Critical（需立即处理）
- [C1] **问题标题**
  - **现象**：描述观察到的问题
  - **指标**：相关数值
  - **修复前状态**：...
  - **修复后状态**：... (如已修复)
  - **当前状态**：已修复 / 待修复

### Medium（建议修复）
- [M1] ...

### Low（可优化）
- [L1] ...

## 验证命令汇总

```bash
# 重新执行审计（相同 seed）
curl -X POST http://localhost:{port}/{pathPrefix}/admin/simulate/unified \
  -H "Content-Type: application/json" \
  -d '{"mode":3,"rounds":2000,"seed":{seed},"playerId":"audit_player_001"}'

# 查看全局 RTP
curl http://localhost:{port}/{pathPrefix}/admin/rtp/global

# 导出控制日志
curl http://localhost:{port}/{pathPrefix}/admin/control-log/export > control-log.json
```

## 附件

- _bmad-output/rtp-audit/{gameId}/logjson/before/ - 修复前数据
- _bmad-output/rtp-audit/{gameId}/logjson/after/ - 修复后数据（如有）
- _bmad-output/rtp-audit/{gameId}/plans/ - 修复计划（如有）

---

如果所有问题已修复，明确标注"审计通过，所有问题已修复"。
如果存在遗留问题，明确标注"部分修复完成，建议使用 /rtp-audit-recheck 进行复查"。
如果无问题且未执行修复，明确标注"审计通过"。
```

---

## 目录结构

```
_bmad-output/rtp-audit/{gameId}/
├── {date}-{seq}-rtp-audit.md           # 首次审计报告
├── {date}-{seq}-rtp-audit-fixed.md     # 修复后对比报告（如有修复）
├── {date}-{seq}-rtp-audit-recheck-1.md # 第1次复查
├── {date}-{seq}-rtp-audit-recheck-2.md # 第2次复查
├── logjson/
│   ├── before/                         # 修复前/首次审计数据
│   │   ├── {gameId}-control-log.json
│   │   ├── stats-overview.json
│   │   ├── stats-by-mode.json
│   │   ├── stats-by-result.json
│   │   ├── global-rtp.json
│   │   └── failure-stats.json
│   ├── after/                          # 修复后数据
│   │   └── ...
│   ├── recheck-1/                      # 第1次复查数据
│   │   └── ...
│   └── recheck-2/                      # 第2次复查数据
│       └── ...
└── plans/
    └── rtp-fix-plan-{timestamp}.md     # 修复计划
```

---

## 完整执行示例

```
用户: /rtp-audit game=ft

Claude: 开始 Fortune Tiger RTP 审计流程（完整闭环）...

[配置加载] 从 game-registry.md 获取配置
→ gameId: ft
→ gameName: Fortune Tiger
→ port: 8084
→ pathPrefix: fortuneTiger
→ gameType: LinePay

[Phase 0] 调用 Haiku Agent 准备环境
→ 停止现有服务：完成
→ 启动服务：成功（耗时 28s）
→ 健康检查：通过
→ purge-all 清理：数据库 5000 条，Redis 126 个 key
→ 文档名：2026-02-04-001-rtp-audit.md

[Phase 1] 调用 Sonnet Agent 执行模拟
→ 模式：3（带控制）
→ 轮次：2000
→ Seed：20260204001
→ actualRtp：98.5%
→ 执行时间：98 秒

[Phase 2] 调用 Sonnet Agent 采集数据
→ 等待日志写入：2000/2000
→ 数据导出到：logjson/before/
→ 控制日志：导出完成（2000 条）

[Phase 3] 调用 Opus Agent 深度分析
→ 游戏类型：LinePay（跳过 FRTPG 检查）
→ 通用指标：3/4 PASS
→ 问题发现：Critical 0, Medium 1, Low 1
→ 需要修复：是

[Phase 4] 调用 Opus Agent 自动修复
→ 停止服务：完成
→ 生成修复计划：plans/rtp-fix-plan-20260204-102030.md
→ 执行修复：2/2 任务完成

[Phase 5] 调用 Sonnet + Opus Agent 复查验证
→ 启动服务：成功
→ purge-all 清理：完成
→ 执行复查模拟：2000 轮
→ 数据导出到：logjson/after/
→ 对比分析：
   - 整体 RTP: 98.5% → 96.2% (改善)
   - 控制触发率: 25% → 45% (改善)
→ 问题修复验证：1/1 已修复

[Phase 6] 调用 superpowers:writing-plans
→ 生成报告：_bmad-output/rtp-audit/ft/2026-02-04-001-rtp-audit.md

审计完成！整体评估：良好（已修复）
- Critical: 0
- Medium: 1 → 0 (已修复)
- Low: 1

详细报告：_bmad-output/rtp-audit/ft/2026-02-04-001-rtp-audit.md
如有遗留问题，使用 /rtp-audit-recheck game=ft 进行复查。
```

---

## 快速参考

| Phase | 工具 | 模型/技能 | 输出 | 条件 |
|-------|------|-----------|------|------|
| 0 | Task | haiku | 环境准备、服务启动、purge-all | 必执行 |
| 1 | Task | sonnet | 模拟结果 | 必执行 |
| 2 | Task | sonnet | logjson/before/ | 必执行 |
| 3 | Task | opus | 问题分类列表 | 必执行 |
| 4 | Task | opus | 修复计划+执行 | 有 Critical/Medium 问题 |
| 5 | Task | sonnet+opus | logjson/after/ + 对比 | Phase 4 执行后 |
| 6 | Skill | superpowers:writing-plans | 版本化审计报告 | 必执行 |

---

## 参数自定义

可以在执行时指定参数：

```
/rtp-audit game=goo mode=1 rounds=5000 seed=12345
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| game | 游戏 ID | mj2 |
| mode | 1(纯引擎)/3(带控制) | 3 |
| rounds | 模拟轮次 | 2000 |
| betSize | 下注金额 | 100 |
| betLevel | 下注等级 | 1 |
| seed | 随机种子 | 日期+序号 |
| playerId | 玩家 ID (mode=3) | audit_player_001 |

---

## 支持的游戏

| gameId | 游戏名 | 端口 | 类型 | FRTPG |
|--------|--------|------|------|-------|
| mj2 | Mahjong Ways 2 | 8082 | Ways | ✓ |
| mj1 | Mahjong Ways 1 | 8083 | Ways | ✓ |
| ft | Fortune Tiger | 8084 | LinePay | - |
| fg | Fortune Gems | 8085 | LinePay | - |
| fg2 | Fortune Gems 2 | 8086 | LinePay | - |
| fr | Fortune Rabbit | 8087 | LinePay | - |
| fo | Fortune Ox | 8088 | LinePay | - |
| goo | Gates of Olympus | 8089 | Tumble | ✓ |
| sb | Sweet Bonanza | 8090 | Tumble | ✓ |
| sp | Starlight Princess | 8091 | Tumble | ✓ |
| gog | Gates of Gatot | 8092 | Tumble | ✓ |
| anubis | Anubis | 8093 | Ways | ✓ |

---

## 相关技能

- **rtp-audit-recheck** - 多轮迭代复查（手动修复后验证）
- **log-analytics** - 完整游戏日志分析
- **game-registry** - 游戏注册表配置
- **superpowers:writing-plans** - 生成详细执行计划
- **superpowers:executing-plans** - 执行修复计划
- **superpowers:systematic-debugging** - 调试复杂问题

---

## 常见问题

### Q: 如何审计 Fortune Tiger？

A: 使用 `/rtp-audit game=ft` 或 `/rtp-audit ft`

### Q: 同一天执行多次会覆盖文档吗？

A: 不会。每次执行都会在对应游戏目录下生成唯一的序号文档（001, 002, 003...）。

### Q: 服务会自动重启吗？

A: 是的。Phase 0 会自动停止现有服务并重新启动，无需手动操作。

### Q: purge-all 会清理什么数据？

A: 会清空所有投注记录（t_bet_detail, t_bet_master）、控制日志（t_control_log）、RTP 统计（t_player_rtp_stats, t_global_rtp_stats）、风险告警（t_risk_alerts）以及 Redis 中的会话、锁、RTP 缓存。

### Q: 自动修复会修改代码吗？

A: 不会。自动修复仅修改配置文件（如 rtp_control_global.json），不修改 Java 代码逻辑。

### Q: 修复失败怎么办？

A: 报告会标注修复状态。如果自动修复未完全解决问题，可使用 `/rtp-audit-recheck` 在手动修复后进行复查验证。

### Q: 服务启动超时怎么办？

A: 健康检查最多等待 60 秒。如果超时，流程会终止并提示检查服务日志。
