// =========================
//  可修改的常量
// =========================

// ① 你的 Padlet 链接（你现在已经填好了）
const PADLET_URL = "https://padlet.com/zhuh49092/padlet-qwdsdjhu5gjina6n";

// ② Google Apps Script Web App 的 URL（你现有在用的那个）
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzc2r3Vl8L6u4pePfMCdesI3ycYGPWLBTWrmjPpAMWRKQ3PqoX8cBt6myxGsgIbGqNM/exec";

// ③ 再进入(revisit)的最小间隔（毫秒）
//    比如 60000 = 1 分钟；300000 = 5 分钟
//    你之前设置的是 10000（10 秒），我先帮你保留
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

const ENTRY_TYPE = getEntryType();
const ROLE_TYPE  = getRoleType();


// =========================
//  匿名 UID & storage 稳定性检测
// =========================

// 生成一个匿名 UID
function generateUid() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e9);
  return `zuid_${ts}_${rand}`;
}

// 读取 cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift() || "";
  }
  return "";
}

// 设置 cookie（默认 365 天）
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${value}; ${expires}; path=/`;
}

// 初始化 UID 和 storage 状态
function initUidAndStorageStatus() {
  let uidLs = "";
  let uidCk = "";

  try {
    uidLs = localStorage.getItem("zoo_bridge_uid") || "";
  } catch (e) {
    uidLs = "";
  }

  uidCk = getCookie("zoo_bridge_uid") || "";

  // 两边都没有 → 第一次访问
  if (!uidLs && !uidCk) {
    const newUid = generateUid();
    try {
      localStorage.setItem("zoo_bridge_uid", newUid);
    } catch (e) {}
    setCookie("zoo_bridge_uid", newUid, 365);
    return {
      uid: newUid,
      storage_status: "first_visit"
    };
  }

  // 两边都有且相等 → 状态稳定
  if (uidLs && uidCk && uidLs === uidCk) {
    return {
      uid: uidLs,
      storage_status: "ok_both"
    };
  }

  // cookie 有，localStorage 没有或不同 → localStorage 曾丢失
  if ((!uidLs && uidCk) || (uidLs && uidCk && uidLs !== uidCk)) {
    const canonicalUid = uidCk || uidLs;
    if (canonicalUid) {
      try {
        localStorage.setItem("zoo_bridge_uid", canonicalUid);
      } catch (e) {}
      setCookie("zoo_bridge_uid", canonicalUid, 365);
      return {
        uid: canonicalUid,
        storage_status: uidLs ? "mismatch_both" : "ls_lost_ck_ok"
      };
    }
  }

  // localStorage 有，cookie 没有 → cookie 丢失
  if (uidLs && !uidCk) {
    setCookie("zoo_bridge_uid", uidLs, 365);
    return {
      uid: uidLs,
      storage_status: "ck_lost_ls_ok"
    };
  }

  // 兜底：如果还是没拿到，就重新生成
  const fallbackUid = generateUid();
  try {
    localStorage.setItem("zoo_bridge_uid", fallbackUid);
  } catch (e) {}
  setCookie("zoo_bridge_uid", fallbackUid, 365);
  return {
    uid: fallbackUid,
    storage_status: "fallback_new"
  };
}

// 计算本次会话的 uid & storage_status（在本次页面生命周期内保持不变）
const UID_INFO = initUidAndStorageStatus();
const DEVICE_UID = UID_INFO.uid || "";
const STORAGE_STATUS = UID_INFO.storage_status || "";


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
    event_type: eventType,      // "page_view" / "revisit" / "padlet_open"
    entry_type: ENTRY_TYPE,     // "nfc" / "qr" / "newspaper" / "unknown"
    role: ROLE_TYPE,            // "organizer" / "visitor"
    uid: DEVICE_UID,            // 匿名设备 ID
    storage_status: STORAGE_STATUS // 当前检测到的存储状态
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
