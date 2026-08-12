# Cloudflare Tunnel Monitor
隧道状态监控面板：一个基于 Cloudflare Worker 的开箱即用轻量级 Cloudflare Tunnel 状态监控与告警系统。

支持 24 小时打卡点可视化展示、近 30 天服务健康度统计、自动 Telegram 告警推送以及优雅的响应式 UI 界面。

本项目同时兼容 **Cloudflare D1 数据库** 与 **Cloudflare KV 命名空间** 两种存储后端。

---

## 🌟 功能特性

- **可视化监控面板**：自适应 24 小时打卡点、最近 30 天中断/正常运行时间细致统计。
- **自动告警与恢复**：隧道掉线或恢复上线时，实时推送 Telegram 告警。
- **动态控制台管理**：前端界面密码解锁后，支持自由添加、擦除、实时修改并排序监控节点。
- **数据解耦持久化**：支持 D1 / KV 云原生存储，保障监控数据稳固不丢失。
- **将敏感信息遮罩**：未授权状态下自动模糊处理敏感域名。

---

## 🚀 部署指南

根据你的实际需求，选择 **【选项 A：首次全新部署】** 或 **【选项 B：已有版本升级（保留历史数据）】**。

---

### 选项 A：首次全新部署

#### 第一步：配置环境变量与存储绑定

1. 创建 Cloudflare Worker 后进入控制台 -> **Settings** -> **Variables and Secrets**，添加以下环境变量：

   | 变量名 | 必填 | 说明/示例 |
   | :--- | :--- | :--- |
   | `ADMIN_PASS` | 是 | 用于解锁前端管理面板的密码（不填写则默认密码为“admin123”） |
   | `BOT_TOKEN` | 否 | Telegram Bot Token（TG中搜索并关注@BotFather 后创建bot） |
   | `CHAT_ID` | 否 | Telegram Chat ID（TG中搜索@userinfobot 发送任意消息获取ID） |
   | `ARGO` | 否 | 可选，格式：`节点1-----域名1;节点2-----域名2` （英文分号“;”）|

2. 添加存储绑定（根据你使用的代码版本选一即可）：
   - **若使用 D1 版本**：前往 D1 创建数据库（如 `TUNNEL_DB`），随后在 Worker 设置中添加 **D1 Database Binding**，变量名填写 `DB` 并绑定该数据库。
   - **若使用 KV 版本**：前往 KV 创建命名空间（如 `TUNNEL_KV`），随后在 Worker 设置中添加 **KV Namespace Binding**，变量名填写 `KV` 并绑定该命名空间。

#### 第二步：运行 SQL 建表与部署代码

1. **部署代码与添加定时任务（D1 版本与 KV 版本均需执行）**：
   - 将项目的 `worker.js` 代码粘贴至 Cloudflare Worker 编辑器中，点击 **Save and Deploy**（保存并部署）。
   - 进入 Worker 控制台的 **Triggers（触发器）** 页面，添加 **Cron Trigger**，建议 Cron 表达式设置为 `*/5 * * * *`（即每5分钟定时拨测一次）。

2. **运行建表语句（仅 D1 版本需要，KV 版本直接跳过此小步）**：
   默认为**自动通过worker自动执行并构建D1数据库**
   
   如网页出现D1数据库报错，则需手动进入 D1 数据库的 **Console** 页面，粘贴并执行以下完整的 SQL 建表语句：

```sql
CREATE TABLE IF NOT EXISTS tunnel_status (
  name TEXT PRIMARY KEY,
  domain TEXT,
  online INTEGER,
  status_code INTEGER,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS tunnel_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  online INTEGER,
  duration INTEGER DEFAULT 60,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS tunnel_notify (
  name TEXT PRIMARY KEY,
  status TEXT
);

CREATE TABLE IF NOT EXISTS tunnels_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  domain TEXT,
  created_at INTEGER
);
```

---

### 选项 B：已有版本升级（保留历史数据）

如果你之前已经部署过本系统的 D1 或 KV 版本，在更新 Worker 代码时**完全不需要删除或清空原有数据**

**但是均需**设置`ADMIN_PASS`**变量**（较上个版本最大升级区别）

#### 第一步：检查绑定名称

前往 Worker 的 **Variables** 界面，确保存储绑定名称与此前一致（D1 版绑定变量名保持为 `DB`，KV 版绑定变量名保持为 `KV`）。

#### 第二步：运行结构补丁并覆盖部署（仅限较早版本的 D1 升级，KV 直接跳过此小步）

1. **运行结构补丁 SQL**：
   若你的旧版 D1 数据库缺少 `duration` 字段，请直接进入 D1 控制台 **Console**，单独执行以下补丁 SQL 即可（**切勿运行 DROP TABLE**）：

```sql
ALTER TABLE tunnel_history ADD COLUMN duration INTEGER DEFAULT 60;
```

   *注：在已有数据库上再次运行完整的 `CREATE TABLE IF NOT EXISTS` 也是安全的，数据库会自动忽略已存在的表并完整保留已有数据。*

2. **覆盖代码与发布（D1 版本与 KV 版本均需执行）**：
   将最新的 `worker.js` 代码覆盖保存并发布，刷新前端控制台即可完成无缝平滑升级。

---

## 🤝 鸣谢与致谢 (作品鸣谢)

本项目诞生创业社区的灵感碰撞与AI工具的辅助支持，特别感谢以下：

🎉感谢佬王(eooce)提供了优秀的开源网络开源基础逻辑参考：[_worker.js](https://github.com/eooce/Databricks-keepalive-workers/blob/main/_worker.js)
✨欢迎大家前往 GitHub 给大佬的项目点亮 Star 🌟，并前往 YouTube 关注大佬的频道，获取更多好玩实用的技术分享！

🤖感谢ChatGPT（免费版）负责了项目前期的代码整合、核心架构架构高颜值UI界面以及初步的制作（有1说1:ChatGPT免费版写代码确实不如Gemini免费版）。

🤖感谢Gemini（免费版）负责了后续多节点大盘快览、移动端重构重构、本地状态记忆、北京时区锁定、智能防修改逻辑等代码的全面与功能完善与二次升级。
