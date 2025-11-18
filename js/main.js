// =========================
// 🔧 需要你手动修改的两个常量
// =========================

// ① PADLET 链接（替换成你的 Padlet URL）
const PADLET_URL = "https://padlet.com/zhuh49092/padlet-qwdsdjhu5gjina6n";

// ② Google Apps Script Web App 的 URL（替换成你的部署地址）
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzc2r3Vl8L6u4pePfMCdesI3ycYGPWLBTWrmjPpAMWRKQ3PqoX8cBt6myxGsgIbGqNM/exec";


// =========================
// 共通工具函数
// =========================

// 从 URL 中获取入口类型 ?entry=qr / ?entry=nfc
function getEntryType() {
  const params = new URLSearchParams(window.location.search);
  const entry = params.get("entry");
  if (entry === "qr" || entry === "nfc") {
    return entry;
  }
  return "unknown";
}

const ENTRY_TYPE = getEntryType();

// 向 GAS 发送日志
function logEvent(eventType) {
  const payload = {
    event_type: eventType,
    entry_type: ENTRY_TYPE,
    client_timestamp: new Date().toISOString()
  };

  // 为了不影响用户体验，不等待返回
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
// page_view 的记录逻辑（含防抖）
// =========================

// 最近一次记录 page_view 的时间戳（毫秒）
let lastPageViewLogTime = 0;

// 统一用这个函数记录 page_view
function logPageView() {
  const now = Date.now();

  // 防抖：5 秒内重复进入前台，不再重复记载
  if (now - lastPageViewLogTime < 5000) {
    return;
  }

  lastPageViewLogTime = now;
  logEvent("page_view");
}


// =========================
// 页面生命周期相关事件
// =========================

// 页面初次加载完成
document.addEventListener("DOMContentLoaded", () => {
  // ① 初次加载时记录一次 page_view
  logPageView();

  // ② 绑定 TAP 按钮点击事件
  const tapButton = document.getElementById("tapButton");
  if (tapButton) {
    tapButton.addEventListener("click", () => {
      // 记录用户从这个页面跳转到 Padlet
      logEvent("padlet_open");
      // 新窗口打开 Padlet
      window.open(PADLET_URL, "_blank");
    });
  }

  // ③ 监听页面从后台回到前台
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // 每次回到前台尝试记录一次 page_view（内部有 5 秒防抖）
      logPageView();
    }
  });
});
