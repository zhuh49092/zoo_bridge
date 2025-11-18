// =========================
// 🔧 需要你手动修改的两个常量
// =========================

// ① PADLET 链接（替换成你的 Padlet URL）
const PADLET_URL = "https://padlet.com/zhuh49092/padlet-qwdsdjhu5gjina6n";

// ② Google Apps Script Web App 的 URL（替换成你的部署地址）
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzc2r3Vl8L6u4pePfMCdesI3ycYGPWLBTWrmjPpAMWRKQ3PqoX8cBt6myxGsgIbGqNM/exec";


// ③ 再进入(revisit)的最小间隔（毫秒）
//    比如 60000 = 1 分钟；300000 = 5 分钟
const MIN_REVISIT_INTERVAL_MS = 60000;


// =========================
//  工具函数
// =========================

// 从 URL 里读入口类型 ?entry=nfc / ?entry=qr
function getEntryType() {
  try {
    const params = new URLSearchParams(window.location.search);
    const entry = (params.get("entry") || "").toLowerCase();
    if (entry === "nfc" || entry === "qr") return entry;
    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

const ENTRY_TYPE = getEntryType();

// 统一的打点函数
function logEvent(eventType) {
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
//  页面初始化
// =========================

document.addEventListener("DOMContentLoaded", () => {
  const now = Date.now();

  // 1) 进入页面（真正 reload）记一次 page_view
  logEvent("page_view");

  // 用 sessionStorage 记录当前标签页上一次记录时间
  // 这样同一个 tab 内的可见 / 再进入可以做节流
  sessionStorage.setItem("bridge_last_log_time", String(now));

  // 2) 绑定 TAP 按钮点击事件
  const tapButton = document.getElementById("tapButton");
  if (tapButton) {
    tapButton.addEventListener("click", (e) => {
      e.preventDefault();

      // 先打点，再开新窗口
      logEvent("padlet_open");
      window.open(PADLET_URL, "_blank", "noopener");
    });
  }

  // 3) 监听标签页从后台回到前台（“再进入”）
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