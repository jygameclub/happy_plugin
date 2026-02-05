# CLAUDE.md 智能更新

根据 git 提交记录智能检查和更新 CLAUDE.md 文件。

## 参数

- `all` - 全量检查所有 CLAUDE.md 文件
- 无参数 - 增量模式，基于最近 git 提交检查

## 执行步骤

### 1. 确定检查范围

**增量模式（无参数）：**
```bash
# 获取最近提交涉及的文件
git log --oneline -20 --name-only
```

**全量模式（all）：**
```bash
# 获取所有 CLAUDE.md 文件
find . -name "CLAUDE.md" -type f
```

### 2. 目录 → CLAUDE.md 映射

根据改动文件路径，映射到对应的 CLAUDE.md：

| 改动路径 | 对应 CLAUDE.md |
|----------|----------------|
| `server-game/<service>/**` | `server-game/<service>/CLAUDE.md` |
| `server-game/game-common/**` | `server-game/game-common/CLAUDE.md` |
| `server-game/game-admin-starter/**` | `server-game/game-admin-starter/CLAUDE.md` |
| `server-game/pom.xml` 等配置 | `server-game/CLAUDE.md` |
| `hubserver/src/.../wallet/**` | `hubserver/.../wallet/CLAUDE.md` |
| `hubserver/**` | `hubserver/CLAUDE.md` |
| 根目录配置文件 | `CLAUDE.md` |

**映射逻辑：**
1. 从改动文件路径向上找最近的 CLAUDE.md
2. 如果目录没有 CLAUDE.md，向上找父目录的
3. 跨模块改动标记根目录 CLAUDE.md 也需检查

### 3. 检查时间线

对于每个映射到的 CLAUDE.md：
```bash
# 获取 CLAUDE.md 最后修改时间
git log -1 --format=%ci -- <path>/CLAUDE.md

# 获取该时间后对应目录的提交
git log --since="<时间>" --oneline -- <对应目录>
```

### 4. 判断是否需要更新

**需要更新：**
| 提交类型 | 说明 |
|----------|------|
| `feat:` | 新功能 - 补充功能说明 |
| `refactor:` | 架构重构 - 更新架构描述 |
| 新增 Controller / API | 补充 API 列表 |
| 新增/删除模块目录 | 更新模块结构 |
| 配置变更 | 更新配置说明 |

**不需要更新：**
| 提交类型 | 说明 |
|----------|------|
| `fix:` | Bug 修复 |
| `style:` | 代码格式 |
| `test:` | 测试代码 |
| `chore:` | 构建/工具（除非重要配置） |
| `docs:` | 已经是文档更新 |

### 5. 输出检查结果

```markdown
## CLAUDE.md 更新检查结果

### 需要更新 (N 个文件)

1. <文件路径>
   相关提交:
   - <commit hash> <commit message>
   建议更新: <具体建议>

2. ...

### 无需更新
跳过 N 个 fix/style/test 类提交
```

### 6. 用户确认

使用 AskUserQuestion 询问：
- 全部应用
- 逐个确认
- 跳过本次

### 7. 执行更新

根据用户确认，更新对应的 CLAUDE.md 文件：
1. 读取现有内容
2. 分析需要更新的章节
3. 智能补充/修改内容
4. 写入文件

### 8. 输出结果

```
已更新:
- server-game/fortunetiger-service/CLAUDE.md
- server-game/CLAUDE.md

跳过:
- server-game/game-common/CLAUDE.md (用户选择跳过)
```

## 注意事项

- 保持 CLAUDE.md 简洁，只记录重要信息
- 不要删除现有有效内容，只做增量更新
- 更新后的内容要符合现有文档风格
