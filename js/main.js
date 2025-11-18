// =========================
// 🔧 需要你手动修改的两个常量
// =========================

// ① PADLET 链接（替换成你的 Padlet URL）
const PADLET_URL = "https://padlet.com/zhuh49092/padlet-qwdsdjhu5gjina6n";

// ② Google Apps Script Web App 的 URL（替换成你的部署地址）
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzc2r3Vl8L6u4pePfMCdesI3ycYGPWLBTWrmjPpAMWRKQ3PqoX8cBt6myxGsgIbGqNM/exec";





// =========================
//  工具函数：入口类型 + 事件上报
// =========================

const VALID_ENTRY_TYPES = ["nfc", "qr"];

// 带“记忆”的入口类型：
// 1) URL 有 ?entry=nfc / qr → 用它并写入 localStorage
// 2) URL 有 ?entry=test → 专用测试模式，不写 localStorage
// 3) URL 没有 → 尝试从 localStorage 拿上一次的 nfc/qr
// 4) 以上都不满足 → "unknown"
function getEntryType() {
  try {
    const params = new URLSearchParams(window.location.search);
    const entryParam = (params.get("entry") || "").toLowerCase();

    // 测试模式：entry=test，不记日志，也不记忆到 localStorage
    if (entryParam === "test") {
      return "test";
    }

    // nfc / qr：本次访问的明确入口，并写入“记忆”
    if (VALID_ENTRY_TYPES.includes(entryParam)) {
      try {
        localStorage.setItem("bridge_last_entry_type", entryParam);
      } catch (e) {}
      return entryParam;
    }

    // 没有参数时，看这台设备以前是否用过 nfc/qr 打开
    try {
      const stored = (localStorage.getItem("bridge_last_entry_type") || "").toLowerCase();
      if (VALID_ENTRY_TYPES.includes(stored)) {
        return stored; // 把后续访问继续归入原入口类型
      }
    } catch (e) {}

    // 完全未知的情况
    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

const ENTRY_TYPE = getEntryType();

// 统一打点函数
function logEvent(eventType) {
  // 专用测试模式：entry=test → 一切不记录
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

  // 1) 进入页面（真正 reload）记一次 page_view
  logEvent("page_view");

  // 用 sessionStorage 控制“同一标签页的节流”
  sessionStorage.setItem("bridge_last_log_time", String(now));

  // 2) 绑定 TAP 按钮点击事件
  const tapButton = document.getElementById("tapButton");
  if (tapButton) {
    tapButton.addEventListener("click", (e) => {
      e.preventDefault();
      logEvent("padlet_open");
      window.open(PADLET_URL, "_blank", "noopener");
    });
  }

  // 3) 监听标签页从后台回到前台（再进入）
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