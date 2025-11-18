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
// 1) URL 上有 ?entry=nfc/qr → 用它并写入 localStorage
// 2) URL 没有 → 尝试从 localStorage 取上一次的
// 3) 都没有 → 返回 "unknown"
function getEntryType() {
  try {
    const params = new URLSearchParams(window.location.search);
    let entry = (params.get("entry") || "").toLowerCase();

    if (VALID_ENTRY_TYPES.includes(entry)) {
      // 记忆当前设备的入口类型（这次是通过 QR 或 NFC）
      try {
        localStorage.setItem("bridge_last_entry_type", entry);
      } catch (e) {}
      return entry;
    }

    // 没带参数，就看这台设备以前是否用过 QR/NFC 打开
    try {
      const stored = (localStorage.getItem("bridge_last_entry_type") || "").toLowerCase();
      if (VALID_ENTRY_TYPES.includes(stored)) {
        return stored; // 把后续访问也归入原来的入口类型
      }
    } catch (e) {}

    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

const ENTRY_TYPE = getEntryType();

// 统一打点函数
function logEvent(eventType) {
  // 关键：只有“这台设备曾经通过 QR 或 NFC 打开过”才记日志
  // 这样：
//  - 真正参与实验的游客（第一次一定是 QR/NFC）→ 全部被统计
//  - 你在 PC 上纯预览（从没带过 entry 参数）→ 一直是 unknown，不会写入 Sheet
  if (!VALID_ENTRY_TYPES.includes(ENTRY_TYPE)) {
    return;
  }

  const payload = {
    client_timestamp: new Date().toISOString(),
    event_type: eventType,   // "page_view" / "revisit" / "padlet_open"
    entry_type: ENTRY_TYPE   // "nfc" / "qr"
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