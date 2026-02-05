# 智能提交推送（含文档更新检查）

执行以下步骤：

## 1. 分析改动

```bash
git status
git diff --stat HEAD
```

## 2. 评估 CLAUDE.md 更新需求

根据改动内容，判断是否需要更新对应的 CLAUDE.md 文件：

### 需要更新的情况

| 改动类型 | 需要更新的 CLAUDE.md |
|----------|---------------------|
| 新增/删除模块 | 根目录 + 父模块 CLAUDE.md |
| 新增/修改 SDK 组件 | game-admin-starter/CLAUDE.md |
| 服务配置变更（端口、数据库） | server-game/CLAUDE.md |
| 新增重要功能/API | 对应服务的 CLAUDE.md |
| 架构变更 | 所有相关 CLAUDE.md |
| 仅 bug 修复/小改动 | 通常不需要 |

### 评估输出格式

```
## CLAUDE.md 更新评估

### 本次改动摘要
- [改动描述]

### 评估结果
- [ ] 根目录 CLAUDE.md - [需要/不需要] - [原因]
- [ ] server-game/CLAUDE.md - [需要/不需要] - [原因]
- [ ] game-admin-starter/CLAUDE.md - [需要/不需要] - [原因]
- [ ] [其他相关 CLAUDE.md]

### 建议更新内容
[如果需要更新，列出具体要更新的内容]
```

## 3. 等待用户确认

使用 AskUserQuestion 询问：
- 是否同意更新建议的 CLAUDE.md？
- 是否有其他需要更新的内容？

## 4. 执行更新（如确认）

根据用户确认，更新对应的 CLAUDE.md 文件。

## 5. 提交并推送

```bash
git add .
git commit -m "[commit message]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin [当前分支]
```

## 注意事项

- 不要过度更新：小的 bug 修复不需要更新文档
- 保持 CLAUDE.md 简洁：只记录重要信息
- 版本号更新：如有重大变更，更新版本号（如 v3.3.0 -> v3.3.1）
