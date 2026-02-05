# 游戏注册表 - Unity 游戏服务配置

此文件定义所有 Unity 游戏服务的配置，供 rtp-audit、rtp-audit-recheck 等技能使用。

## 游戏配置表

| gameId | gameName | port | pathPrefix | database | gameType | serviceName |
|--------|----------|------|------------|----------|----------|-------------|
| mj2 | Mahjong Ways 2 | 8082 | mahjong2 | mj2_db | Ways | mahjong2-service |
| mj1 | Mahjong Ways 1 | 8083 | mahjong1 | mj1_db | Ways | mahjong1-service |
| ft | Fortune Tiger | 8084 | fortuneTiger | ft_db | LinePay | fortunetiger-service |
| fg | Fortune Gems | 8085 | fortuneGems | fg_db | LinePay | fortunegems-service |
| fg2 | Fortune Gems 2 | 8086 | fortuneGems2 | fg2_db | LinePay | fortunegems2-service |
| fr | Fortune Rabbit | 8087 | fortuneRabbit | fr_db | LinePay | fortunerabbit-service |
| fo | Fortune Ox | 8088 | fortuneOx | fo_db | LinePay | fortuneox-service |
| goo | Gates of Olympus | 8089 | gatesOfOlympus | goo_db | Tumble | gatesofolympus-service |
| sb | Sweet Bonanza | 8090 | sweetBonanza | sb_db | Tumble | sweetbonanza-service |
| sp | Starlight Princess | 8091 | starlightPrincess | sp_db | Tumble | starlightprincess-service |
| gog | Gates of Gatot | 8092 | gatesOfGatot | gog_db | Tumble | gatesofgatot-service |
| anubis | Anubis | 8093 | anubis | anubis_db | Ways | anubis-service |

## 默认游戏

默认游戏 ID: `mj2` (Mahjong Ways 2)

## 游戏类型说明

| 类型 | 游戏列表 | 特性 |
|------|----------|------|
| Ways | mj2, mj1, anubis | 级联消除、FRTPG 最终防线、预计算 |
| Tumble | goo, sb, sp, gog | 6x5 棋盘、级联消除、FRTPG |
| LinePay | ft, fg, fg2, fr, fo | 固定赔付线、无级联、无 FRTPG |

## 启动命令

| gameId | 启动命令 |
|--------|----------|
| mj2 | `cd server-game/mahjong2-service && mvn spring-boot:run` |
| mj1 | `cd server-game/mahjong1-service && mvn spring-boot:run` |
| ft | `cd server-game/fortunetiger-service && mvn spring-boot:run` |
| fg | `cd server-game/fortunegems-service && mvn spring-boot:run` |
| fg2 | `cd server-game/fortunegems2-service && mvn spring-boot:run` |
| fr | `cd server-game/fortunerabbit-service && mvn spring-boot:run` |
| fo | `cd server-game/fortuneox-service && mvn spring-boot:run` |
| goo | `cd server-game/gatesofolympus-service && mvn spring-boot:run` |
| sb | `cd server-game/sweetbonanza-service && mvn spring-boot:run` |
| sp | `cd server-game/starlightprincess-service && mvn spring-boot:run` |
| gog | `cd server-game/gatesofgatot-service && mvn spring-boot:run` |
| anubis | `cd server-game/anubis-service && mvn spring-boot:run` |

## API 可用性

| API 类别 | 可用性 | 说明 |
|----------|--------|------|
| ControlLog, Cleanup, Rtp, System | 统一可用 | game-admin-starter 提供 |
| Simulate mode=1 | 依赖实现 | 需要 IGameSimulator SPI |
| Simulate mode=3 | 依赖实现 | 需要 SimulationBatchProcessor |

**已验证支持完整模拟**: mj2, mj1, goo, sb, sp, gog, anubis (Ways/Tumble 类型)

**需验证模拟支持**: ft, fg, fg2, fr, fo (LinePay 类型)
