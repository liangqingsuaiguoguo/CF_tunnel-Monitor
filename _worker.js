// ========================================
// Cloudflare Tunnel Monitor
// Version: 1.1 (Beijing Time & Intelligent Button Status)
// KV Namespace Variable Name: KV
// ========================================

const ONLINE_CODES = [200, 301, 302, 403, 404, 502, 521, 522];

function getConfig(env) {
  return {
    ARGO: env.ARGO || env.argo || "", 
    BOT_TOKEN: env.BOT_TOKEN || "",
    CHAT_ID: env.CHAT_ID || ""
  };
}

// 统一获取北京时间的字符串
function getBeijingTimeString() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
}

// 解析节点
function parseArgoConfig(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split("-----");
      return {
        name: parts[0]?.trim(),
        domain: parts[1]?.trim()
      };
    })
    .filter(v => v.name && v.domain);
}

// Telegram 发送通知
async function sendTelegram(env, message) {
  if (!env.BOT_TOKEN || !env.CHAT_ID) return false;
  try {
    const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    });
    const data = await resp.json();
    return data.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// 检查单个隧道
async function checkTunnel(domain) {
  try {
    const resp = await fetch(`https://${domain}`, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "TunnelMonitor/2.0" }
    });
    return {
      online: ONLINE_CODES.includes(resp.status),
      statusCode: resp.status,
      timestamp: Date.now()
    };
  } catch (e) {
    return {
      online: false,
      statusCode: 0,
      error: e.message,
      timestamp: Date.now()
    };
  }
}

// KV 键名定义
const statusKey = name => `status:${name}`;
const historyKey = name => `history:${name}`;
const notifyKey = name => `notify:${name}`;

// 获取历史
async function getHistory(kv, name) {
  const raw = await kv.get(historyKey(name));
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// 保存历史记录
async function saveHistory(kv, name, online) {
  let history = await getHistory(kv, name);
  history.push({ t: Date.now(), s: online ? 1 : 0 });
  if (history.length > 168) history = history.slice(-168); 
  await kv.put(historyKey(name), JSON.stringify(history));
  return history;
}

function calculateUptime(history) {
  if (!history.length) return "100.0";
  const online = history.filter(v => v.s === 1).length;
  return ((online / history.length) * 100).toFixed(1);
}

function buildHeatmap(history) {
  if (!history.length) return "⬜";
  return history.map(h => (h.s ? "🟩" : "🟥")).join("");
}

// 执行探测并更新状态
async function processTunnel(env, kv, tunnel) {
  const result = await checkTunnel(tunnel.domain);
  
  await kv.put(statusKey(tunnel.name), JSON.stringify(result));
  const history = await saveHistory(kv, tunnel.name, result.online);
  const notified = await kv.get(notifyKey(tunnel.name));

  if (!result.online && notified !== "offline") {
    await sendTelegram(env, `❌ <b>${tunnel.name} 离线告警</b>\n\n🌐 ${tunnel.domain}\n\n状态码：<code>${result.statusCode || "连接失败"}</code>\n\n时间：${getBeijingTimeString()}`);
    await kv.put(notifyKey(tunnel.name), "offline");
  }

  if (result.online && notified === "offline") {
    await sendTelegram(env, `✅ <b>${tunnel.name} 已恢复上线</b>\n\n🌐 ${tunnel.domain}\n\n状态：<code>${result.statusCode}</code>\n\n时间：${getBeijingTimeString()}`);
    await kv.put(notifyKey(tunnel.name), "online");
  }

  return {
    name: tunnel.name,
    domain: tunnel.domain,
    online: result.online,
    statusCode: result.statusCode,
    uptime: calculateUptime(history),
    heat: buildHeatmap(history)
  };
}

// ========================================
// 前端页面 HTML (新增时区锁定与状态防呆按钮)
// ========================================
function getFrontendHTML(hasTunnels, hasTelegram) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Cloudflare Tunnel Monitor</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f5f7;padding:15px;color:#333;}
.container{max-width:1000px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);}

.header{padding:25px 15px;color:#fff;background:linear-gradient(135deg,#1f2937,#334155);text-align:center;}
.header h1{font-size:24px;font-weight:700;}
.header p{margin-top:6px;opacity:.8;font-size:13px;}

.controls{padding:12px 15px;background:#f8fafc;display:flex;gap:10px;flex-wrap:wrap;}
button{padding:10px 16px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;transition: opacity 0.2s;flex:1;min-width:100px;text-align:center;}
button:hover{opacity:0.9;}
.primary{background:#2563eb;color:white;}
.success{background:#16a34a;color:white;}
button:disabled, button.disabled{background:#cbd5e1 !important;color:#94a3b8 !important;cursor:not-allowed !important;opacity:1 !important;}

.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:15px;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
.card{padding:12px;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.03);border-left:4px solid #2563eb;text-align:center;}
.number{font-size:22px;font-weight:bold;}
.label{margin-top:4px;color:#666;font-size:11px;}

.overview-box{margin:15px;padding:12px;background:#f1f5f9;border-radius:8px;font-size:13px;}
.overview-title{font-weight:bold;margin-bottom:6px;color:#475569;display:flex;justify-content:space-between;}
.overview-tags{display:flex;flex-wrap:wrap;gap:6px;}
.tag-item{padding:3px 8px;background:white;border-radius:4px;border:1px solid #cbd5e1;display:inline-flex;align-items:center;gap:4px;font-size:12px;}

.tunnel-list{padding:5px 15px 15px 15px;}
.tunnel{margin-bottom:12px;border-radius:8px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.04);border:1px solid #e2e8f0;overflow:hidden;}
.online{border-left:5px solid #22c55e;}
.offline{border-left:5px solid #ef4444;}

.tunnel-header{padding:14px;background:#fff;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;}
.tunnel-header:hover{background:#f8fafc;}
.tunnel-title-left h3{font-size:16px;font-weight:700;word-break:break-all;}
.tunnel-title-left span{font-size:12px;color:#71717a;word-break:break-all;display:block;margin-top:2px;}
.toggle-status{font-size:12px;color:#2563eb;font-weight:600;background:#eff6ff;padding:2px 8px;border-radius:4px;}

.tunnel-body{padding:0 14px 14px 14px;border-top:1px dashed #e2e8f0;background:#fafafa;display:none;}
.tunnel-body.show{display:block;}

.status-line{font-size:13px;font-weight:bold;margin:10px 0 6px 0;display:flex;align-items:center;gap:5px;}
.uptime-line{font-size:13px;color:#444;margin-bottom:10px;}
.heat{font-size:13px;letter-spacing:1px;line-height:18px;word-break:break-all;background:#fff;padding:8px;border-radius:6px;border:1px solid #f1f5f9;}

.footer{padding:15px;text-align:center;color:#777;font-size:12px;line-height:1.6;}

@media(min-width:600px){
  body{padding:20px;}
  .header{padding:35px;}
  .header h1{font-size:30px;}
  .header p{font-size:14px;}
  .stats{gap:15px;padding:20px;}
  .card{padding:20px;text-align:left;}
  .number{font-size:32px;}
  .label{font-size:13px;}
  button{flex:none;padding:12px 24px;font-size:15px;}
  .tunnel-header{padding:16px;}
  .tunnel-title-left h3{font-size:18px;}
  .tunnel-title-left span{font-size:13px;display:inline;margin-left:10px;}
  .tunnel-body{padding:0 16px 16px 16px;}
  .heat{font-size:14px;letter-spacing:2px;line-height:22px;}
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌐 Tunnel Monitor</h1>
    <p>Cloudflare Tunnel 在线监控面板</p>
  </div>
  <div class="controls">
    <button class="primary" id="refreshBtn" ${!hasTunnels ? 'disabled' : ''} onclick="triggerRefresh()">${hasTunnels ? '刷新状态' : '隧道未配置'}</button>
    <button class="success" id="pushBtn" ${!hasTelegram ? 'disabled' : ''} onclick="pushStatus()">${hasTelegram ? '发送状态' : 'TG未配置'}</button>
  </div>
  
  <div class="stats" id="stats">
    <div class="card"><div class="number">-</div><div class="label">隧道总数</div></div>
    <div class="card" style="border-left-color:#16a34a"><div class="number" style="color:#16a34a">-</div><div class="label">在线</div></div>
    <div class="card" style="border-left-color:#ef4444"><div class="number" style="color:#ef4444">-</div><div class="label">离线</div></div>
  </div>

  <div class="overview-box" id="overviewBox" style="display:none;">
    <div class="overview-title">📋 节点大盘快览 <span style="font-weight:normal;font-size:11px;color:#64748b;">点击下方卡片可看详情</span></div>
    <div class="overview-tags" id="overviewTags"></div>
  </div>

  <div class="tunnel-list" id="list">加载中...</div>

  <div class="footer">7×24 小时在线记录（数据自动维护）<br>🟩 在线 🟥 离线 ⬜ 无数据</div>
</div>

<script>
let localToggleState = {};
try {
  localToggleState = JSON.parse(localStorage.getItem("monitor_toggle_state") || "{}");
} catch(e) {}

function triggerRefresh() {
  const btn = document.getElementById("refreshBtn");
  btn.innerText = "正在硬刷新...";
  btn.style.opacity = "0.6";
  window.location.reload();
}

async function loadDataAndRender(){
  // 如果隧道压根没配置，直接给一个友好的提示，不去请求 API
  if(${!hasTunnels}) {
    document.getElementById("list").innerHTML = '<div style="padding:30px; text-align:center; color:#ef4444; font-size:14px;">⚠️ 监测到环境变量中未配置任何有效的 ARGO 隧道节点。</div>';
    return;
  }

  try {
    const r = await fetch("/status");
    const data = await r.json();
    
    document.getElementById("stats").innerHTML = \`
      <div class="card"><div class="number">\${data.total}</div><div class="label">隧道总数</div></div>
      <div class="card" style="border-left-color:#16a34a"><div class="number" style="color:#16a34a">\${data.online}</div><div class="label">在线</div></div>
      <div class="card" style="border-left-color:#ef4444"><div class="number" style="color:#ef4444">\${data.offline}</div><div class="label">离线</div></div>
    \`;

    let html = "";
    let tagsHtml = "";

    if(!data.items || data.items.length === 0){
      html = '<div style="padding:30px; text-align:center; color:#999; font-size:14px;">暂无隧道数据，请等待首次定时触发或手动执行</div>';
      document.getElementById("overviewBox").style.display = "none";
    } else {
      document.getElementById("overviewBox").style.display = "block";
      
      data.items.forEach((v) => {
        tagsHtml += \`<div class="tag-item">\${v.online ? '🟢' : '🔴'} \${v.name}</div>\`;

        const storageKey = "toggle_" + v.name;
        if (localToggleState[storageKey] === undefined) {
          localToggleState[storageKey] = data.items.length <= 3;
        }
        const isShow = localToggleState[storageKey];

        html += \`
          <div class="tunnel \${v.online ? 'online' : 'offline'}">
            <div class="tunnel-header" onclick="toggleBody('\${v.name}')">
              <div class="tunnel-title-left">
                <h3>\${v.name} \${v.online ? '🟢' : '🔴'}</h3>
                <span>\${v.domain}</span>
              </div>
              <div class="toggle-status" id="btn_\${v.name}">\${isShow ? '收起' : '展开'}</div>
            </div>
            <div class="tunnel-body \${isShow ? 'show' : ''}" id="body_\${v.name}">
              <div class="status-line">
                状态：\${v.online ? '<span style="color:#16a34a">在线</span>' : '<span style="color:#ef4444">离线</span>'} 
                <span style="color:#666;font-weight:normal;font-size:12px;">(状态码: \${v.statusCode})</span>
              </div>
              <div class="uptime-line">历史在线率：<strong>\${v.uptime}%</strong></div>
              <div class="heat">\${v.heat}</div>
            </div>
          </div>
        \`;
      });
    }
    document.getElementById("list").innerHTML = html;
    document.getElementById("overviewTags").innerHTML = tagsHtml;
  } catch(e) {
    document.getElementById("list").innerHTML = '<div style="color:red;padding:20px;text-align:center;">数据加载失败，请检查网络或刷新重试</div>';
  }
}

function toggleBody(name) {
  const body = document.getElementById("body_" + name);
  const btn = document.getElementById("btn_" + name);
  const storageKey = "toggle_" + name;
  
  if (body.classList.contains("show")) {
    body.classList.remove("show");
    btn.innerText = "展开";
    localToggleState[storageKey] = false;
  } else {
    body.classList.add("show");
    btn.innerText = "收起";
    localToggleState[storageKey] = true;
  }
  localStorage.setItem("monitor_toggle_state", JSON.stringify(localToggleState));
}

async function pushStatus(){
  const btn = document.getElementById("pushBtn");
  btn.innerText = "正在发送...";
  btn.style.opacity = "0.6";
  try {
    const res = await fetch("/push-status", { method: "POST" });
    const result = await res.json();
    if(result.success) {
      alert("📋 实时隧道状态已成功推送到您的 Telegram！");
    } else {
      alert("发送失败: " + result.error);
    }
  } catch(e) {
    alert("网络请求失败，请稍后重试");
  } finally {
    btn.innerText = "发送状态";
    btn.style.opacity = "1";
  }
}

loadDataAndRender();
setInterval(loadDataAndRender, 30000);
</script>
</body>
</html>`;
}

// ========================================
// Worker 路由核心
// ========================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const config = getConfig(env);
    const tunnels = parseArgoConfig(config.ARGO);

    const hasTunnels = tunnels.length > 0;
    const hasTelegram = config.BOT_TOKEN !== "" && config.CHAT_ID !== "";

    // 1. 监控主页 (在这里传入当前的配置健全性状态，实现智能防呆样式)
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(getFrontendHTML(hasTunnels, hasTelegram), {
        headers: { "content-type": "text/html;charset=utf-8" }
      });
    }

    // 2. 读取状态路由
    if (url.pathname === "/status") {
      try {
        const kvNamespace = env.KV;
        if (!kvNamespace) {
          return Response.json({ error: "未找到名为大写 KV 的变量绑定。" }, { status: 500 });
        }

        const items = [];
        for (const tunnel of tunnels) {
          const rawStatus = await kvNamespace.get(statusKey(tunnel.name));
          const history = await getHistory(kvNamespace, tunnel.name);
          
          let online = false;
          let statusCode = 0;
          
          if (rawStatus) {
            const statusObj = JSON.parse(rawStatus);
            online = statusObj.online;
            statusCode = statusObj.statusCode;
          }

          items.push({
            name: tunnel.name,
            domain: tunnel.domain,
            online: online,
            statusCode: statusCode,
            uptime: calculateUptime(history),
            heat: buildHeatmap(history)
          });
        }

        return Response.json({
          total: items.length,
          online: items.filter(v => v.online).length,
          offline: items.filter(v => !v.online).length,
          items
        });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // 3. 处理“发送状态”指令到 TG Bot (已完美转换北京时间)
    if (url.pathname === "/push-status" && request.method === "POST") {
      try {
        const kvNamespace = env.KV;
        if (!kvNamespace) return Response.json({ success: false, error: "KV 绑定缺失" }, { status: 500 });
        
        let onlineCount = 0;
        let offlineCount = 0;
        const offlineDetails = [];

        for (const tunnel of tunnels) {
          const rawStatus = await kvNamespace.get(statusKey(tunnel.name));
          let online = false;
          if (rawStatus) {
            online = JSON.parse(rawStatus).online;
          }
          
          if (online) {
            onlineCount++;
          } else {
            offlineCount++;
            offlineDetails.push(`• <b>${tunnel.name}</b> (${tunnel.domain})`);
          }
        }

        let tgMessage = `📊 <b>Tunnel Monitor 实时大盘状态</b>\n`;
        tgMessage += `━━━━━━━━━━━━━━━━━━\n`;
        tgMessage += `🌐 隧道总数：<b>${tunnels.length}</b> 个\n`;
        tgMessage += `🟢 在线总数：<b>${onlineCount}</b> 个\n`;
        tgMessage += `🔴 离线数量：<b>${offlineCount}</b> 个\n`;
        
        if (offlineCount > 0) {
          tgMessage += `\n⚠️ <b>离线隧道详情：</b>\n`;
          tgMessage += offlineDetails.join("\n") + `\n`;
        } else {
          tgMessage += `\n✨ 所有监控节点目前运行良好！\n`;
        }
        tgMessage += `━━━━━━━━━━━━━━━━━━\n`;
        // 这里已精准变更为获取绝对可靠的北京时间
        tgMessage += `⏱️ 发送时间：${getBeijingTimeString()}`;

        const ok = await sendTelegram(config, tgMessage);
        return Response.json({ success: ok });
      } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },

  // ========================================
  // 定时任务触发器
  // ========================================
  async scheduled(event, env, ctx) {
    if (!env) return;
    
    const kvNamespace = env.KV;
    if (!kvNamespace) return;

    const config = getConfig(env);
    const tunnels = parseArgoConfig(config.ARGO);

    if (tunnels.length === 0) return;

    ctx.waitUntil(
      (async () => {
        try {
          for (const tunnel of tunnels) {
            await processTunnel(config, kvNamespace, tunnel);
          }
        } catch (e) {
          console.error(e);
        }
      })()
    );
  }
};
