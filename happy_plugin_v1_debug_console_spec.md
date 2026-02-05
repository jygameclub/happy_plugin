# Happy 插件 v1.0 Debug / Test Console 执行文档

## 1. 文档目的

本文件用于指导 AI 或开发者实现 Happy 浏览器插件 v1.0 的 Debug / Test
Console。
该版本以"可观测、可验证、可回放"为第一优先级，而非自动化完成任务。

------------------------------------------------------------------------

## 2. 版本定位

-   类型：开发者调试版（Debug-first）
-   平台：Google Chrome 浏览器插件
-   范围：单页面 Happy 多终端环境
-   不追求无人值守，仅验证可控性

------------------------------------------------------------------------

## 3. 核心设计原则

1.  所有未来自动化，必须先能通过按钮手动验证
2.  所有动作必须可预览、可回滚
3.  AI 仅用于"判断 / 分类"，不直接执行危险动作
4.  Debug 面板是长期模块，不是临时代码

------------------------------------------------------------------------

## 4. 插件 UI 结构

侧边栏（Sidebar）分区：

-   Environment
-   Session / Terminal
-   Input Simulation
-   API / AI Judge
-   Action Simulation
-   Logs & Inspector

------------------------------------------------------------------------

## 5. Debug 功能清单（v1.0）

### 5.1 Check API Status

-   检查 MiniMax / GLM API Key 是否存在
-   执行最小请求验证连通性
-   输出延迟与错误信息

### 5.2 Scan Sessions

-   扫描当前页面所有终端
-   输出 sessionId / 标题 / 可见性
-   记录 DOM 根节点 selector

### 5.3 Preview Input Injection

-   高亮当前终端输入框
-   填充测试文本但不提交
-   验证输入注入可靠性

### 5.4 Switch Active Session

-   在终端之间切换控制对象
-   UI 显示当前 active session
-   高亮对应终端区域

### 5.5 Analyze Session via API

-   输入 session 编号
-   提取最近 N 行输出
-   调用 AI Judge 返回结构化判断

### 5.6 Simulate Action

-   根据 AI 判断生成"将要执行"的动作
-   仅展示，不执行

------------------------------------------------------------------------

## 6. 建议补充 Debug 功能

### 6.7 Test Output Listener

-   测试增量输出捕获能力

### 6.8 Detect Waiting State

-   并列展示规则判断与 AI 判断

### 6.9 Simulate Timeout

-   模拟 WAITING_INPUT 状态
-   显示 30s 倒计时

### 6.10 Dangerous Command Filter Test

-   测试危险命令拦截逻辑

### 6.11 Inject & Rollback Test

-   注入测试输入后立即撤销

### 6.12 Export Debug Snapshot

-   导出当前调试状态为 JSON

------------------------------------------------------------------------

## 7. 数据与接口约定

### 7.1 Session 数据结构

{ "sessionId": "string", "title": "string", "visible": true,
"domSelector": "string" }

### 7.2 AI Judge 输入

{ "recent_text": \[...\], "signals": {...} }

### 7.3 AI Judge 输出

{ "role": "Advisor \| Executor \| Other", "state": "RUNNING \|
WAITING_INPUT \| ERROR", "confidence": 0.0 }

------------------------------------------------------------------------

## 8. 安全与防呆

-   自动执行前必须有预览
-   危险命令必须二次确认
-   AI 判断错误不得导致不可逆操作

------------------------------------------------------------------------

## 9. v1.0 完成标准（DoD）

-   能扫描并识别多个终端
-   能稳定注入但不提交输入
-   能通过 API 返回结构化判断
-   所有动作可预览、可撤销
-   调试日志可导出

------------------------------------------------------------------------

## 10. 后续版本方向（非本期）

-   自动角色识别（Advisor / Executor）
-   半自动 / 自动模式
-   多 AI Judge 协同
-   Agent 工作流编排
