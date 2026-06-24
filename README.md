# 🌐 Cloudflare Tunnel Monitor

这是一个基于 Cloudflare Workers 和 KV 数据库构建的 **轻量级、高颜值、零成本** 的 Cloudflare Tunnel 隧道在线监控面板。支持 7×24 小时自动拨测、历史在线率统计（热力图趋势）、移动端深度适配以及 Telegram 机器人实时故障离线/恢复告警。

## ✨ 特性功能
- ⚡ **无感秒开**：基于读写分离架构，前端页面毫秒级瞬间加载。
- 📱 **移动适配**：完美适配手机端单手浏览，支持大盘节点一键折叠与快捷快览。
- 🔔 **实时告警**：隧道离线或恢复上线时，Telegram 机器人秒级推送。
- 📊 **一键状态**：支持在面板上一键将当前所有隧道的运行简报手动推送到 Telegram。
- ⏱️ **北京时间**：告警与简报时区精准锁定北京时间。

## 🛠️ 部署教程

### 1. 创建 Cloudflare Worker
1. 登录 Cloudflare 控制台，进入 `Workers & Pages`。
2. 点击 `Create Application` -> `Create Worker`。
3. 复制本项目中的 `index.js` 代码，覆盖并点击 `Save and Deploy`。

### 2. 配置环境变量 (Settings -> Variables)
在 Worker 的配置后台中，添加以下 `Environment Variables`（环境变量）：
- `ARGO`：填入你需要监控的隧道信息，格式为 `节点名称-----你的域名`（多个节点换行输入）。
  *示例：*
  ```text
  香港主路由-----hk.yourdomain.com
  美国备用机-----us.yourdomain.com
