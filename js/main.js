// =========================
//  可修改的常量
// =========================

// ① 你的 Padlet 链接
const PADLET_URL = "https://padlet.com/zhuh49092/padlet-qwdsdjhu5gjina6n";

// ② Google Apps Script Web App 的 URL
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzc2r3Vl8L6u4pePfMCdesI3ycYGPWLBTWrmjPpAMWRKQ3PqoX8cBt6myxGsgIbGqNM/exec";

// ③ 再进入(revisit)的最小间隔（毫秒）
//    例如：10000 = 10秒；60000 = 1分钟
const MIN_REVISIT_INTERVAL_MS = 10000;


// =========================
//  URL 参数解析
// =========================

// 入口类型：nfc / qr / newspaper / test / unknown
function getEntryType() {
  try {
    const params = new URLSearchParams(window.location.search);
    const entryParam = (params.get("entry") || "").toLowerCase();

    if (entryParam === "test") {
      return "test"; // 专用测试模式：完全不记录
    }
    if (entryParam === "nfc" || entryParam === "qr" || entryParam === "newspaper") {
      return entryParam;
    }
    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

// 角色：organizer / visitor
function getRoleType() {
  try {
    const params = new URLSearchParams(window.location.search);
    const roleParam = (params.get("role") || "").toLowerCase();

    if (roleParam === "organizer") {
      return "organizer";
    }
    // 默认视为一般来園者
    return "visitor";
  } catch (e) {
    return "visitor";
  }
}

// 报纸ID：从 URL 参数 npid 中读取（例如 ?entry=newspaper&npid=NP01）
function getNewspaperId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const npid = (params.get("npid") || "").trim();
    return npid;
  } catch (e) {
    return "";
  }
}

const ENTRY_TYPE    = getEntryType();
const ROLE_TYPE     = getRoleType();
const NEWSPAPER_ID  = getNewspaperId();


// =========================
//  事件上报函数
// =========================

function logEvent(eventType) {
  // 专用测试模式：?entry=test → 一切不记录
  if (ENTRY_TYPE === "test") {
    return;
  }

  const payload = {
    client_timestamp: new Date().toISOString(),
    event_type: eventType,       // "page_view" / "revisit" / "padlet_open"
    entry_type: ENTRY_TYPE,      // "nfc" / "qr" / "newspaper" / "unknown"
    role: ROLE_TYPE,             // "organizer" / "visitor"
    newspaperid: NEWSPAPER_ID    // ★ 报纸ID（非报纸入口时通常为空）
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
