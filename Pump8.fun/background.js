// 缓存
const userStatsCache = new Map();
const detailsCache = new Map();
const postTweetCache = new Map();

// API 配置
const API_BASE = "https://fuckscam.com/api/v1/pump8";
const API_ENDPOINTS = {
  stats: "/userStatus",
  nameChanges: "/names",
  pumpCount: "/tweets",
};

async function fetchFromApi(endpoint, params, otherParams) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `${API_BASE}${endpoint}${queryString ? "?" + queryString : ""}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("request error:", error);
    throw error;
  }
}

// 获取用户基础统计
async function fetchUserStats(username, currentActivecode) {
  try {
    const data = await fetchFromApi(API_ENDPOINTS.stats, {
      userName: username,
      activeCode: currentActivecode,
    });
    if (data.code === 1 && data.data) {
      return {
        fetchError: false,
        nameChanges: data.data.names_count || 0,
        pumpCount: data.data.pump_tweets_count || 0,
        deletedTweets: data.data.deleted_pump_tweets_count || 0,
        followed_kol_count: data.data.followed_kol_count || 0,
        followed_kols: data.data.followed_kols || [],
      };
    }
    return {
      fetchError: true,
      names_count: 0,
      pump_tweets_count: 0,
      deleted_pump_tweets_count: 0,
      followed_kol_count: 0,
      followed_kols: [],
    };
  } catch (error) {
    console.error("fetchUserStats error:", error);
    return {
      fetchError: true,
      names_count: 0,
      pump_tweets_count: 0,
      deleted_pump_tweets_count: 0,
      followed_kol_count: 0,
      followed_kols: [],
    };
  }
}
async function active() {
  const code = await chrome.storage.sync.get("code");

  const response = await fetch(`${API_BASE}/active`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Code": code ? code.code : "",
    },
    body: JSON.stringify({
      code: code ? code.code : "",
    }),
  });

  const data = await response.json();
  if (data.code === 1) {
    updateBadge(data.data.alert_tweets.length);
  } else {
    console.error("active error:", data);
  }
}

// 获取详细历史数据
async function fetchUserDetails(type, username, currentActivecode) {
  try {
    const endpoint = API_ENDPOINTS[type];
    if (!endpoint) {
      throw new Error("unknown type");
    }
    const data = await fetchFromApi(endpoint, {
      userName: username,
      activeCode: currentActivecode,
    });
    return data;
  } catch (error) {
    console.error("fetchUserDetails error:", error);
    throw error;
  }
}

async function postTweet(username, userId, tweet) {
  try {
    const data = await fetchFromApi(
      API_ENDPOINTS.postTweet,
      {
        username,
        userId,
      },
      {
        tweet,
      }
    );
    return data;
  } catch (error) {
    console.error("postTweet error:", error);
    throw error;
  }
}

async function deleteTweetAlert(username, userId) {
  try {
    const data = await fetchFromApi(API_ENDPOINTS.DeleteTweetAlert, {
      username,
      userId,
    });
    if (data.code === 1) {
      const count = data.data;
      if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "rgb(255, 149, 0)" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    }

    return data;
  } catch (error) {
    console.error("deleteTweetAlert error:", error);
    throw error;
  }
}

// 添加睡眠函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getUserStats") {
    // 异步获取数据
    (async () => {
      try {
        // 检查缓存
        const cacheKey = `${request.username}-${request.userId}`;
        let stats = userStatsCache.get(cacheKey);
        if (!stats) {
          // 如果缓存中没有，则获取新数据
          stats = await fetchUserStats(request.username, request.Activecode);
          // 存入缓存
          if (!stats.fetchError) {
            userStatsCache.set(cacheKey, stats);
          }
        }

        sendResponse({ stats });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();

    return true;
  } else if (request.action === "getgmgnUserStats") {
    (async () => {
      try {
        // 检查缓存
        let stats = await fetchUserStats(request.username, request.Activecode);
        sendResponse({ stats });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  } else if (request.action === "getUserDetails") {
    (async () => {
      try {
        const cacheKey = `${request.type}-${request.username}-${request.userId}`;
        let details = detailsCache.get(cacheKey);
        if (!details) {
          details = await fetchUserDetails(
            request.type,
            request.username,
            request.currentActivecode
          );
          detailsCache.set(cacheKey, details);
        }

        sendResponse({ details });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  } else if (request.action === "postTweet") {
    (async () => {
      const cacheKey = `${request.username}-${request.userId}`;
      let exist = postTweetCache.get(cacheKey);
      if (!exist) {
        await postTweet(request.username, request.userId, request.tweet);
        postTweetCache.set(cacheKey, true);
      }
    })();
    return true;
  } else if (request.action === "deleteTweetAlert") {
    (async () => {
      await deleteTweetAlert(request.username, request.userId);
    })();
    return true;
  }
});

// 定期清理缓存（每小时）
setInterval(() => {
  userStatsCache.clear();
  detailsCache.clear();
  postTweetCache.clear();
}, 3600000);

chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

class NotificationManager {
  constructor() {
    this.notificationQueue = [];
    this.hasOffscreenDocument = false; // 添加这个标记

    // 监听通知点击
    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });
  }

  async createOffscreenDocument() {
    if (this.hasOffscreenDocument) return;

    // 检查是否已存在 offscreen document
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });

    if (existingContexts.length > 0) {
      this.hasOffscreenDocument = true;
      return;
    }

    // 创建新的 offscreen document
    await chrome.offscreen.createDocument({
      url: "audio.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Playing notification sound",
    });

    this.hasOffscreenDocument = true;
  }

  async playNotificationSound() {
    try {
      await this.createOffscreenDocument();
      chrome.runtime.sendMessage({ action: "playSound" });
    } catch (error) {
      console.error("播放提示音失败:", error);
    }
  }

  async showNotification(data) {
    try {
      const { notificationSound } = await chrome.storage.sync.get({
        notificationSound: true,
      });

      if (notificationSound) {
        await this.playNotificationSound();
      }

      // 创建通知
      const notificationId = `notification-${Date.now()}`;
      const notificationOptions = {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "删推提醒",
        message: `用户 ${data.screen_name} 删除了推文`,
        priority: 2,
        requireInteraction: true,
        buttons: [
          {
            title: "查看详情",
          },
          {
            title: "忽略",
          },
        ],
      };

      chrome.notifications.create(notificationId, notificationOptions);

      // 存储通知数据以供后续使用
      this.notificationQueue.push({
        id: notificationId,
        data: data,
      });

      // 限制队列长度
      if (this.notificationQueue.length > 10) {
        const oldNotification = this.notificationQueue.shift();
        chrome.notifications.clear(oldNotification.id);
      }
    } catch (error) {
      console.error("显示通知失败:", error);
    }
  }

  handleNotificationClick(notificationId) {
    // 查找对应的通知数据
    const notification = this.notificationQueue.find(
      (n) => n.id === notificationId
    );
    if (!notification) return;

    // 构建推文 URL
    const tweetUrl = `https://x.com/${notification.data.screen_name}/status/${notification.data.tweet_id}`;

    // 打开相关页面
    chrome.tabs.create({ url: tweetUrl });

    // 清除通知
    chrome.notifications.clear(notificationId);
    this.notificationQueue = this.notificationQueue.filter(
      (n) => n.id !== notificationId
    );
  }
}

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 3000; // 3秒
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000; // 30秒发送一次心跳
    this.reconnectDelay = 3000;
    this.notificationManager = new NotificationManager();
    // this.init();
  }

  async init() {
    try {
      const code = await chrome.storage.sync.get("code");
      if (!code || !code.code) {
        this.reconnect();
        return;
      }

      this.ws = new WebSocket(`${this.url}?code=${code ? code.code : ""}`);

      this.setupEventListeners();
    } catch (error) {
      console.error("WebSocket 连接失败:", error);
      this.reconnect();
    }
  }

  setupEventListeners() {
    this.ws.onopen = () => {
      this.reconnectAttempts = 0; // 重置重连次数
      this.startHeartbeat(); // 开始心跳
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error("解析消息失败:", error);
      }
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket 连接已关闭:", event.code, event.reason);
      this.stopHeartbeat(); // 停止心跳
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket 错误:", error);
    };
  }

  handleMessage(data) {
    // 处理不同类型的消息
    // console.log("handleMessage data:", data);
    switch (data.type) {
      case "tweet_deleted":
        this.notificationManager.showNotification(data.data);
        this.updateBadge(data.data.alert_count);
        break;
      case "update_alert_count":
        this.updateBadge(data.data.alert_count);
        break;
      case "pong":
        break;
      default:
        console.log("收到未知类型消息:", data);
    }
  }

  updateBadge(count) {
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "rgb(255, 149, 0)" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }

  // notifyContentScript(data) {
  // 	chrome.tabs.query({ active: true }, (tabs) => {
  // 		tabs.forEach((tab) => {
  // 			chrome.tabs.sendMessage(tab.id, {
  // 				action: "websocketMessage",
  // 				data: data,
  // 			});
  // 		});
  // 	});
  // }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error("WebSocket 未连接，无法发送消息");
    }
  }

  reconnect() {
    if (this.ws) {
      this.reconnectAttempts++;
      console.log(
        `尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
    }

    setTimeout(() => {
      this.init();
    }, this.reconnectDelay);
  }

  close() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }

  // 添加心跳相关方法
  startHeartbeat() {
    this.stopHeartbeat(); // 确保之前的心跳被清除
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" });
      }
    }, this.heartbeatTimeout);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

class WebSocketManager {
  constructor() {
    this.instance = null;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new WebSocketManager();
    }
    return this.instance;
  }

  getClient() {
    return this.wsClient;
  }

  async initWebSocket() {
    if (this.wsClient) {
      console.log("WebSocket 已存在，无需重复连接");
      return this.wsClient;
    }

    this.wsClient = new WebSocketClient("wss://pumpscam.com/api/pumpPill/ws");
    return this.wsClient;
  }

  closeWebSocket() {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }
}

// 创建单例
const wsManager = WebSocketManager.getInstance();

// 初始化 WebSocket
wsManager.initWebSocket();

// 在扩展关闭时清理连接
chrome.runtime.onSuspend.addListener(() => {
  wsManager.closeWebSocket();
});
