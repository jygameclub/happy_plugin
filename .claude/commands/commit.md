# 智能提交（含轻量文档检查）

执行以下步骤：

## 1. 查看改动

```bash
git status
git diff --stat HEAD
```

## 2. 快速扫描重大变更

检查是否涉及以下重大变更（只需快速判断，不做详细分析）：

| 重大变更类型 | 判断标准 |
|--------------|----------|
| 新增/删除模块 | pom.xml 变更、新目录 |
| SDK 组件变更 | game-admin-starter 下的 Abstract*.java |
| 配置变更 | application.yml 中端口/数据库变更 |
| API 变更 | 新增 Controller 或端点 |

## 3. 输出结果

### 如果检测到重大变更

```
⚠️ 检测到重大变更：[变更类型]
   涉及文件：[文件列表]
   💡 提醒：push 前记得更新相关 CLAUDE.md
```

然后继续提交。

### 如果无重大变更

直接提交，不输出提醒。

## 4. 生成 commit message 并提交

分析改动，生成符合规范的 commit message：

```bash
git add .
git commit -m "[type]: [description]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Commit 类型

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| refactor | 重构 |
| docs | 文档更新 |
| chore | 构建/工具变更 |
| style | 代码格式 |
| test | 测试 |

## 注意

- **不推送到远程**
- **不强制更新 CLAUDE.md**，只是提醒
- 详细的文档更新在 push 时处理
