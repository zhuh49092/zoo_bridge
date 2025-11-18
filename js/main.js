// =========================
// 🔧 需要你手动修改的两个常量
// =========================

// ① PADLET 链接（替换成你的 Padlet URL）
const PADLET_URL = "https://padlet.com/zhuh49092/padlet-qwdsdjhu5gjina6n";

// ② Google Apps Script Web App 的 URL（替换成你的部署地址）
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzc2r3Vl8L6u4pePfMCdesI3ycYGPWLBTWrmjPpAMWRKQ3PqoX8cBt6myxGsgIbGqNM/exec";





// =========================
//  入口类型 & 事件上报
// =========================

// 只看当前 URL 上的 entry
// ?entry=nfc  → "nfc"
// ?entry=qr   → "qr"
// ?entry=test → "test"（调试用，完全不记日志）
// 其它 / 没有 → "unknown"
function getEntryType() {
  try {
    const params = new URLSearchParams(window.location.search);
    const entryParam = (params.get("entry") || "").toLowerCase();

    if (entryParam === "test") {
      return "test";
    }
    if (entryParam === "nfc" || entryParam === "qr") {
      return entryParam;
    }
    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

const ENTRY_TYPE = getEntryType();

function logEvent(eventType) {
  // 专用测试模式：?entry=test → 一切不记录
  if (ENTRY_TYPE === "test") {
    return;
  }

  const payload = {
    client_timestamp: new Date().toISOString(),
    event_type: eventType,   // "page_view" / "revisit" / "padlet_open"
    entry_type: ENTRY_TYPE   // "nfc" / "qr" / "unknown"
  };

  try {
    fetch(LOG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("logEvent error:", err);
  }
}


// =========================
//  页面初始化 & 事件绑定
// =========================

document.addEventListener("DOMContentLoaded", () => {
  const now = Date.now();

  // 1) 页面真正加载时，记一次 page_view
  logEvent("page_view");

  // 用 sessionStorage 控制“同一标签页的节流”
  sessionStorage.setItem("bridge_last_log_time", String(now));

  // 2) 绑定 TAP 按钮（图片）点击事件
  const tapButton = document.getElementById("tapButton");
  if (tapButton) {
    tapButton.addEventListener("click", (e) => {
      e.preventDefault();
      logEvent("padlet_open");
      window.open(PADLET_URL, "_blank", "noopener");
    });
  }

  // 3) 监听从后台回到前台 → 统计 revisit
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const now = Date.now();
      const last = Number(sessionStorage.getItem("bridge_last_log_time") || 0);

      // 距离上一次打点超过设定间隔，才记一次 revisit
      if (!last || now - last >= MIN_REVISIT_INTERVAL_MS) {
        logEvent("revisit");
        sessionStorage.setItem("bridge_last_log_time", String(now));
      }
    }
  });
});