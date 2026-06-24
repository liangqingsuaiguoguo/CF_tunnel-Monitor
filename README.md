# 🌐 Cloudflare Tunnel Monitor

<p align="center">
  <img src="[https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white)" alt="Cloudflare Workers" />
  <img src="[https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=Telegram&logoColor=white](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=Telegram&logoColor=white)" alt="Telegram Bot" />
  <img src="[https://img.shields.io/badge/License-MIT-green?style=for-the-badge](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)" alt="MIT License" />
  <img src="[https://img.shields.io/badge/Cost-Zero-brightgreen?style=for-the-badge](https://img.shields.io/badge/Cost-Zero-brightgreen?style=for-the-badge)" alt="Zero Cost" />
</p>

这是一个基于 Cloudflare Workers 和 KV/D1 数据库构建的 **轻量级、高颜值、零成本** 的 Cloudflare Tunnel 隧道在线监控面板。支持 7×24 小时自动拨测、历史在线率统计（热力趋势图）、移动端深度适配、智能防呆按钮以及 Telegram 机器人实时故障离线/恢复告警。

---

## ✨ 特性功能

* ⚡️ **无感秒开**：基于读写分离架构，前端页面毫秒级瞬间加载。
* 🔔 **实时告警**：隧道离线或恢复上线时，Telegram 机器人秒级精准推送。
* ⏱️ **北京时间**：告警与简报时区精准锁定北京时间，不再有 8 小时时差困扰。
* 📱 **移动适配**：完美适配手机端单手浏览，支持大盘节点一键折叠与快捷快览。
* 📊 **一键状态**：支持在面板上一键将当前所有隧道的运行简报手动推送到 Telegram。
* 🛡️ **智能防呆**：若未配置 Telegram 或 ARGO 隧道，前端按钮会自动变灰并显示“TG未配置”或“隧道未配置”。

---

## 🛠️ 详细部署教程

### 📥 第一步：创建 Cloudflare Worker

1. 登录 Cloudflare 控制台，在左侧导航栏选择 `Workers & Pages`（Workers 和 Pages）。
2. 点击 `Create Application`（创建应用程序） -> `Create Worker`（创建 Worker）。
3. 为你的 Worker 起一个名字（例如 `tunnel-monitor`），然后点击 `Deploy`（部署）。
4. 部署完成后，点击 `Edit Code`（编辑代码），将本项目 `index.js（可自行选择KV/D1版本）` 中的全部代码复制并**完全覆盖**里面的默认代码。
5. 点击右上角的 `Deploy`（部署）保存。

---

### 🗄️ 第二步：创建并绑定 KV/D1 数据库

> [!NOTE]
> **请根据你选择的代码版本（KV 或 D1），对应执行下方的配置：**

#### 💡 选项 A：KV 版本
由于监控需要记录历史在线率（24小时绿红格子热力图），必须绑定一个 KV 数据库：
1. 回到 Cloudflare 主控制台，点击左侧菜单的 `KV`。
2. 点击 `Create a Namespace`（创建命名空间），输入名字：`tunnel_monitor`，点击添加。
3. 回到你刚才创建的 Worker 页面，点击 `Settings`（设置）选项卡 -> 选择 `Bindings`（绑定）。
4. 在 `KV Namespace Bindings`（KV 命名空间绑定）部分点击 `Add Binding`（添加绑定）：
   * **Variable name（变量名称）**：必须**大写**填入 `KV`
   * **KV namespace（KV 命名空间）**：下拉菜单选择你刚才创建的 `tunnel_monitor`
5. 点击保存。

#### 💡 选项 B：D1 版本
如果节点数量较多，确实会产生非常庞大的 KV 写入量，而 D1 拥有极高的写入额度：
1. 登录 Cloudflare 控制台，在左侧菜单进入 `Storage & Databases` -> `D1`。
2. 点击 `Create database`（创建数据库），起名为 `tunnel_monitor`。
3. 点击进入你刚刚创建的 `tunnel_monitor` 数据库，找到 `Console`（控制台）或者 `Execute Statement`。
4. 将以下 SQL 语句复制进去并点击执行（如果是本地 Wrangler 部署，也可以保存为 `schema.sql` 后执行命令）：

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
    timestamp INTEGER
); 

CREATE INDEX IF NOT EXISTS idx_history_name_time ON tunnel_history(name, timestamp); 

CREATE TABLE IF NOT EXISTS tunnel_notify (
    name TEXT PRIMARY KEY, 
    status TEXT
);
```

5. 绑定 D1 到你的 Worker，进入 `Settings`（设置） -> `Bindings`（绑定）。点击 `Add` 按钮，选择 `D1 database binding`：
   * **Variable name（变量名称）**：必须大写填入 `DB`
6. 下拉菜单选择你刚才创建的 `tunnel_monitor`，点击保存并部署。

---

### ⚙️ 第三步：配置环境变量 (Variables)

在 Worker 页面的 `Settings`（设置）选项卡中，选择 `Variables`（变量），点击 `Add Variable`（添加变量）配置以下内容：

1. **`ARGO`**：填入你需要监控的隧道，格式为 `自定义名称-----你的域名`（注意中间是 **5 个短横线**）。如果有多个隧道，**直接回车换行**输入即可。
   
   *配置示例：*
   ```text
   香港主隧道-----hk.yourdomain.com
   美国副隧道-----us.yourdomain.com
   ```

2. **`BOT_TOKEN`**：填入你的 Telegram 机器人的 Token（可选，不填前端按钮会显示“TG未配置”）。
3. **`CHAT_ID`**：填入你的 Telegram 账号 ID 或群组 ID（可选，不行去问问大佬自己的ID是什么）。

> [!IMPORTANT]
> 配置完成后，记得点击 **`Save and Deploy`（保存并部署）**。

---

### ⏱️ 第四步：添加定时触发器 (Cron Triggers)

让 Worker 实现 7×24 小时自动拨测检测：
1. 在 Worker 页面选择 `Settings`（设置） -> `Triggers`（触发器）。
2. 下拉找到 `Cron Triggers`（定时触发器），点击 `Add Trigger`（添加触发器）。
3. 在 Cron 表达式中选择或输入你的触发频率：
   * 比如输入 `*/5 * * * *` 表示每 5 分钟自动检测一次。
   * 节点较多时，建议设置为 `*/10 * * * *`（每 10 分钟检测一次）。

---

## 🤝 鸣谢与致谢 (Credits)

本项目的诞生离不开开源社区的灵感碰撞与 AI 工具的辅助支持，特别感谢以下付出：

1. **感谢 佬王 (eooce)** 提供了优秀的开源网络探针基础逻辑参考：[_worker.js](https://github.com/eooce/Databricks-keepalive-workers/blob/main/_worker.js)
   > ✨ 欢迎大家前往 GitHub 给大佬的项目**点亮 Star 🌟**，并前往 YouTube 关注大佬的频道，获取更多好玩实用的技术分享！

2. **感谢 ChatGPT (免费版)** 负责了项目前期的代码初步整合、核心架构搭建以及高颜值 UI 界面的初步制作。

3. **感谢 Gemini (免费版)** 负责了后续多节点大盘快览、移动端适配重构、本地状态记忆、北京时区精准锁定、智能防呆逻辑等代码的全面修正与功能完善。

---

## 📝 开源协议

本项目基于 [MIT](LICENSE) 协议开源，欢迎自由分发、修改及使用。
