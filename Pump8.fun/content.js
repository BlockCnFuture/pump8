let hasDisplayedStats = false
let currentTweetID = null
let currentBtnTweetID = null
//获取激活码
async function getCode() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['code'], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(result.code) // 返回 code 值
      }
    })
  })
}
//获取用户的username
function getUserInfo() {
  try {
    const url = new URL(location.href)
    const paths = url.pathname.split('/')
    if (paths.length < 2) {
      return null
    }
    const hrefUsername = paths[1]
    const span = document.querySelector('[data-testid="UserName"] div[tabindex] div[dir] > span')
    if (!span) {
      return null
    }

    const username = span.textContent.replace('@', '')
    if (hrefUsername.toLowerCase() !== username.toLowerCase()) {
      return null
    }

    let userId = null
    const followBtn = document.querySelector('[data-testid="placementTracking"] > div > button')
    if (followBtn) {
      const followIDStr = followBtn.getAttribute('data-testid')
      if (!followIDStr || (!followIDStr.includes('-follow') && !followIDStr.includes('-unfollow'))) {
        return null
      }

      const fllowIDArr = followIDStr.split('-')

      if (fllowIDArr.length === 2) {
        userId = fllowIDArr[0]
      }
    } else {
      let moreA = document.querySelector('aside > a')
      if (moreA) {
        const moreUrl = new URL(moreA.href)
        userId = moreUrl.searchParams.get('user_id')
      }
    }

    if (!userId) {
      return null
    }
    return { username, userId }
  } catch (error) {
    console.log('getUserInfo err:', error)
    return null
  }
}
//获取gmgn的token地址
function gmgngetUserInfo() {
  const gmgnurl = new URL(location.href)
  const paths = gmgnurl.pathname.split('/')
  const user_address = paths[3].slice(0, 5) + '...' + paths[3].slice(-3)
  const observer = new MutationObserver(function (mutationsList, observer) {
    const user_dom = document.querySelector('.css-1uwb7zu')

    if (user_dom) {
      observer.disconnect()
      if (user_address == user_dom.innerHTML) {
        gmgninsertAnalytics()
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
//调用接口获取用户详细数据
async function getUserStats(userInfo, Activecode) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'getUserStats',
        username: userInfo.username,
        userId: userInfo.userId,
        Activecode: Activecode
      },
      response => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response.stats)
        }
      }
    )
  })
}
//调用接口获取gmgn用户详细数据
async function gmgngetUserStats(address, Activecode) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'getgmgnUserStats',
        username: address,
        Activecode: Activecode
      },
      response => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response.stats)
        }
      }
    )
  })
}
async function insertAnalytics(headerElement, forceUpdate = false) {
  let analyticsBox = headerElement.querySelector('.twitter-analytics-box')
  const userInfo = getUserInfo()
  if (!userInfo) return

  if (analyticsBox) {
    if (!forceUpdate && analyticsBox.dataset.username === userInfo.username && analyticsBox.dataset.userId === userInfo.userId) {
      return
    }
    analyticsBox.remove()
  }

  analyticsBox = document.createElement('div')
  analyticsBox.className = 'twitter-analytics-box'
  analyticsBox.dataset.username = userInfo.username
  analyticsBox.dataset.userId = userInfo.userId || ''
  analyticsBox.innerHTML = getLoadingHTML()
  headerElement.appendChild(analyticsBox)

  const autoQuery = await chrome.storage.sync.get({
    enableAutoQuery: true,
    code: ''
  })

  if (!autoQuery.code) {
    const currentBox = headerElement.querySelector('.twitter-analytics-box')
    currentBox.innerHTML = ` <span class="analytics-item noactivate" data-type="toQuery"> <a href="https://pump8.fun" target="_blank" rel="noopener noreferrer">请先激活插件</a ></span> `
    hasDisplayedStats = true
    return
  }
  if (!autoQuery.enableAutoQuery) {
    const currentBox = headerElement.querySelector('.twitter-analytics-box')
    currentBox.innerHTML = `
					<span class="analytics-item" data-type="toQuery">点击查询</span>
				`
    hasDisplayedStats = true
    addStatsClickHandlers(currentBox, userInfo)
    return
  }
  const stats = await ToQuery(headerElement, userInfo)
  // 添加KOL关注者信息
  if (stats && stats.followed_kols) {
    await insertKOLFollowers(userInfo, stats)
  }
}
async function gmgninsertAnalytics() {
  const observer = new MutationObserver((mutationsList, observer) => {
    const user_box = document.querySelector('.css-1av451l')

    if (user_box) {
      observer.disconnect(user_box)
      gmgnwdom(user_box)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
//向页面中插入dom
async function ToQuery(headerElement, userInfo) {
  try {
    var Activecode = await getCode()
    const stats = await getUserStats(userInfo, Activecode)
    const currentBox = headerElement.querySelector('.twitter-analytics-box')
    if (currentBox && currentBox.dataset.username === userInfo.username && currentBox.dataset.userId === userInfo.userId) {
      if (!stats || stats.fetchError) {
        currentBox.innerHTML = `
					<span class="analytics-item">数据获取失败</span>
				`
        hasDisplayedStats = true
      } else {
        currentBox.innerHTML = `
      <div style="display: flex; gap: 4px; flex-direction: column;">
        <div  style="display: flex; align-items: center; gap: 4px;">
					<span class="analytics-item changename" data-type="nameChanges">改名(${stats.nameChanges})</span>
		      <span class="analytics-item yoffer" data-type="pumpCount">发盘(${stats.pumpCount})</span>
              <span class="yremind" style="display: flex; align-items: center; gap: 4px;">
		        回推提醒
		        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
		          <path d="M11.996 2c-4.062 0-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958C19.48 5.017 16.054 2 11.996 2zM9.171 18h5.658c-.412 1.165-1.523 2-2.829 2s-2.417-.835-2.829-2z"/>
		        </svg>
	        </span>
        </div> 
        <div  style="display: flex; align-items: center; gap: 4px;"> 
          <span class="analytics-item noactivate white" style="display: flex; align-items: center; gap: 4px;">
		        由pump8.fun提供插件
	        </span>
        </div>
      </div>     
				`
        // 添加KOL关注者信息
        if (stats && stats.followed_kols) {
          await insertKOLFollowers(userInfo, stats)
        }
        addStatsClickHandlers(currentBox, userInfo)
        hasDisplayedStats = true
        return stats
      }
    }
  } catch (error) {
    console.error('getUserStats err:', error)
    const currentBox = headerElement.querySelector('.twitter-analytics-box')
    if (currentBox && currentBox.dataset.username === userInfo.username && currentBox.dataset.userId === userInfo.userId) {
      currentBox.innerHTML = `
				<span class="analytics-item">加载失败</span>
			`
    }
  }
}
//gmgn插入dom
async function gmgnwdom(dom) {
  const autoQuery = await chrome.storage.sync.get({
    enableAutoQuery: true,
    code: ''
  })
  let currentBox = document.createElement('div')
  currentBox.className = 'gmgn-analytics-box'
  dom.appendChild(currentBox)
  if (!autoQuery.code) {
    console.log(dom, 'one')
    currentBox.innerHTML = ` <span class="analytics-item gmgnnoactivate" data-type="toQuery"> <a href="https://pump8.fun" target="_blank" rel="noopener noreferrer">请先激活插件</a ></span> `
    return
  }
  gmgntoQuery(currentBox)
}
//gmgn插入统计后的dom
async function gmgntoQuery(boxdom) {
  try {
    const gmgnurl = new URL(location.href)
    const paths = gmgnurl.pathname.split('/')
    var Activecode = await getCode()
    const gmgnstats = await gmgngetUserStats(paths[3], Activecode)
    if (boxdom) {
      if (!gmgnstats) {
        boxdom.innerHTML = `
  				<span class="analytics-item">数据获取失败</span>
  			`
      } else {
        boxdom.innerHTML = `
  				<span class="analytics-item gmgnitem" data-type="nameChanges">改名(${gmgnstats.nameChanges})</span>
  				<span class="analytics-item gmgnitem" data-type="pumpCount">发盘(${gmgnstats.pumpCount})</span>
  				<span class="analytics-item gmgnitem" data-type="deletedTweets">由pump8.fun提供插件</span>
  			`
      }
    }
  } catch (error) {
    console.error('getUserStats err:', error)
    if (boxdom) {
      boxdom.innerHTML = `
  			<span class="analytics-item">加载失败</span>
  		`
    }
  }
}
function getLoadingHTML() {
  return `
		<div class="analytics-loading">
			<div class="dot"></div>
			<div class="dot"></div>
			<div class="dot"></div>
		</div>
	`
}

let isUpdating = false
let isInitialLoad = true

function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// 清除统计框
function clearAnalytics() {
  //移除分析信息框
  const analyticsBox = document.querySelector('.twitter-analytics-box')
  if (analyticsBox) {
    analyticsBox.remove()
  }
  //移除 KOL 粉丝信息框
  const kolBox = document.querySelector('.twitter-kol-followers-box')
  if (kolBox) {
    kolBox.remove()
  }
  //移除自定义按钮框
  const btnBox = document.querySelector('.custom-twitter-button')
  if (btnBox) {
    btnBox.remove()
  }
  hasDisplayedStats = false
}

// 检查并更新用户信息
const checkAndUpdate = debounce(async () => {
  if (isUpdating) {
    return
  }

  try {
    isUpdating = true
    const userHeader = document.querySelector('[data-testid="UserName"], [data-testid="UserNameDisplay"]')
    if (userHeader) {
      await insertAnalytics(userHeader, true)
    }
  } finally {
    setTimeout(() => {
      isUpdating = false
      if (isInitialLoad) {
        isInitialLoad = false
      }
    }, 500)
  }
}, 100)

const checkAndUpdateTweetTime = debounce(async () => {
  try {
    try {
      const tweetAs = document.querySelectorAll('article[data-testid="tweet"]') //尝试获取所有推文元素
      if (!tweetAs) return

      const currentUrl = window.location.href
      const currentUrlMatch = currentUrl.match(/x\.com\/([^/]+)\/status\/(\d+)/)
      if (!currentUrlMatch) return

      const [, currentUsername, currentTweetId] = currentUrlMatch

      for (const article of tweetAs) {
        const tweetA = article.querySelector('a[href*="/status/"]')
        if (!tweetA) continue

        const tweetUrlMatch = tweetA.href.match(/x\.com\/([^/]+)\/status\/(\d+)/)
        if (!tweetUrlMatch) continue

        const [, tweetUsername, tweetId] = tweetUrlMatch
        if (tweetUsername.toLowerCase() !== currentUsername.toLowerCase() || tweetId !== currentTweetId) {
          continue
        }

        const timeElement = article.querySelector('time')
        if (!timeElement) continue

        const tweetID = tweetA.href.split('/status/')[1].split('?')[0].split('/')[0]
        if (currentTweetID === tweetID) continue

        currentTweetID = tweetID

        const datetime = timeElement.getAttribute('datetime')
        if (datetime) {
          const date = new Date(datetime)
          const seconds = date.getSeconds()
          const text = timeElement.textContent

          const minuteMatch = text.match(/\d+:\d+/)
          if (minuteMatch) {
            const minuteIndex = minuteMatch.index + minuteMatch[0].length
            const newText = `${text.slice(0, minuteIndex)}:${seconds.toString().padStart(2, '0')}${text.slice(minuteIndex)}`
            timeElement.textContent = newText
          }
        }
      }
    } catch (error) {
      console.error('更新时间出错:', error)
    }
  } finally {
    setTimeout(() => {
      isUpdating = false
      if (isInitialLoad) {
        isInitialLoad = false
      }
    }, 500)
  }
}, 100)

// 初始化观察器
function initializeObservers() {
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', initializeObservers)
    return
  }
  //执行gmgn
  let lastUrl = location.href
  const gmgnurl = new URL(location.href)
  const paths = gmgnurl.pathname.split('/')
  if (paths[1] == 'sol') {
    gmgngetUserInfo()
  }
  // 合并 URL 和 DOM 变化的处理
  const observer = new MutationObserver(() => {
    const currentUrl = location.href

    checkAndUpdateTweetTime()
    //页面发生跳转
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl

      clearAnalytics()
      checkAndUpdate()
    } else if (!isUpdating && !isInitialLoad) {
      const userHeader = document.querySelector('[data-testid="UserName"], [data-testid="UserNameDisplay"]')
      if (userHeader && !hasDisplayedStats) {
        checkAndUpdate() //执行更新
      }
    }
  })

  try {
    observer.observe(document.body, {
      subtree: true,
      childList: true
    })
  } catch (error) {
    console.error('observer err:', error)
  }

  if (isInitialLoad) {
    checkAndUpdate()
  }
}

// 开始初始化
initializeObservers()
function getUserData(username) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'GET_USER_DATA', username }, response => {
      if (response.error) {
        reject(response.error)
      } else {
        resolve(response)
      }
    })
  })
}
// 添加弹窗相关代码
class StatsModal {
  constructor() {
    this.modal = null
    this.overlay = null
    this.currentUsername = null
    this.currentUserId = null
    this.currentActivecode = null
  }

  create() {
    // 创建遮罩
    this.overlay = document.createElement('div')
    this.overlay.className = 'modal-overlay'

    // 创建弹窗
    this.modal = document.createElement('div')
    this.modal.className = 'twitter-stats-modal'

    // 创建弹窗内容
    this.modal.innerHTML = `
			<div class="modal-header">
				<div class="modal-title">加载中...</div>
				<div class="modal-close">✕</div>
			</div>
			<div class="modal-content">
				<div class="modal-loading">
					${getLoadingHTML()}
				</div>
			</div>
		`

    // 添加关闭事件
    this.modal.querySelector('.modal-close').addEventListener('click', () => {
      this.close()
    })

    // 点击遮罩关闭
    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) {
        this.close()
      }
    })

    // 添加到页面
    document.body.appendChild(this.overlay)
    document.body.appendChild(this.modal)

    // 添加 ESC 键关闭
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal) {
        this.close()
      }
    })
  }

  //创建一个模态框 (modal)，并根据不同的类型请求并展示相关的内容
  async show(type, username, userId, Activecode) {
    this.currentUsername = username
    this.currentUserId = userId
    this.currentActivecode = Activecode
    if (!this.modal) {
      this.create()
    }

    // 设置标题
    const titles = {
      nameChanges: '改名历史',
      pumpCount: '发盘记录',
      deletedTweets: '删推记录'
    }

    this.modal.querySelector('.modal-title').textContent = titles[type] || '详情'

    try {
      // 显示加载中
      this.modal.querySelector('.modal-content').innerHTML = `
				<div class="modal-loading">
					${getLoadingHTML()}
				</div>
			`

      // 根据类型调用不同的 API
      const data = await this.fetchData(type)
      // 更新内容
      await this.updateContent(type, username, data)
    } catch (error) {
      console.error('获取详情失败:', error)
      this.modal.querySelector('.modal-content').innerHTML = '加载失败，请稍后重试'
    }
  }
  //用来获取与用户相关的详细信息
  async fetchData(type) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'getUserDetails',
          type,
          username: this.currentUsername,
          currentActivecode: this.currentActivecode
        },
        response => {
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response.details)
          }
        }
      )
    })
  }

  async updateContent(type, username, data) {
    // 根据不同类型展示不同的内容
    let content = ''

    if (data.code === 1 && data.data) {
      setTimeout(() => {
        const addresses = this.modal.querySelectorAll('.token-address')
        addresses.forEach(div => {
          div.addEventListener('click', () => {
            const address = div.dataset.address
            navigator.clipboard.writeText(address)
          })
        })
      }, 0)

      switch (type) {
        case 'nameChanges':
          content = this.renderNameChanges(username, data.data)
          break
        case 'pumpCount':
          content = await this.renderPumpHistory(username, data.data)
          break
        case 'deletedTweets':
          content = await this.renderDeletedTweets(username, data.data)
          break
      }
    } else {
      content = '暂无数据'
    }

    this.modal.querySelector('.modal-content').innerHTML = content
  }

  renderNameChanges(username, data) {
    // 渲染改名历史
    return `
			<div class="name-history">
				${data
          .map(
            item => `
					<div class="history-item">
                        <div class="token-address" data-address="${item.token_address}">
                            ${item.token_address} 📋
                        </div>
                        <div class="change"><a href="https://x.com/${item.twitter_screen_name}" target="_blank">https://x.com/${item.twitter_screen_name}</a></div>
					</div>
				`
          )
          .join('')}
			</div>
		`
  }

  async renderPumpHistory(username, data) {
    const prefix = await chrome.storage.sync.get({
      contractPrefix: 'https://gmgn.ai/sol/token/'
    })
    // 渲染发盘记录
    return `
			<div class="pump-history">
				${data.tweets
          .map(
            item => `
					<div class="history-item">
						<div class="time">${new Date(item.publish_time * 1000).toLocaleString()}</div>
						<a class="content" href="https://x.com/${username}/status/${item.tweet_id}" target="_blank">${item.text}</a>
                         <a href="${prefix.contractPrefix}${item.token_address}" target="_blank"><div class="token-address" data-address="${
              item.token_address
            }">
                            ${item.token_address} 📋
                        </div></a>
					</div>
				`
          )
          .join('')}
			</div>
		`
  }

  async renderDeletedTweets(username, data) {
    const prefix = await chrome.storage.sync.get({
      contractPrefix: 'https://gmgn.ai/sol/token/'
    })
    // 渲染删推记录
    return `
			<div class="delete-history">
				${data.tweets
          .map(
            item => `
					<div class="history-item">
						<div class="time">${new Date(item.publish_time * 1000).toLocaleString()}</div>
						<a class="content" href="https://x.com/${username}/status/${item.tweet_id}" target="_blank">${item.text}</a>
                         <a href="${prefix.contractPrefix}${item.token_address}" target="_blank"><div class="token-address" data-address="${
              item.token_address
            }">
                            ${item.token_address} 📋
                        </div></a>
					</div>
				`
          )
          .join('')}
			</div>
		`
  }

  close() {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
  }
}

// 创建全局弹窗实例
const statsModal = new StatsModal()

// 修改统计框的点击事件
function createStatsHTML(stats) {
  return `
  <span class="analytics-item" data-type="nameChanges">改名(${stats.nameChanges})</span>
  <span class="analytics-item" data-type="pumpCount">发盘(${stats.pumpCount})</span>
	<span class="analytics-item" data-type="deletedTweets">删推(${stats.deletedTweets})</span>
	<span class="analytics-item" data-type="deletedTweets">回复提醒(${stats.deletedTweets})</span>
	`
}

// 在 insertAnalytics 函数中更新统计框内容时添加点击事件
function addStatsClickHandlers(analyticsBox, userInfo) {
  const items = analyticsBox.querySelectorAll('.analytics-item')
  items.forEach(item => {
    item.style.cursor = 'pointer'
    item.addEventListener('click', async () => {
      const type = item.dataset.type
      if (type === 'toQuery') {
        const userHeader = document.querySelector('[data-testid="UserName"], [data-testid="UserNameDisplay"]')
        analyticsBox.innerHTML = getLoadingHTML()
        const stats = await ToQuery(userHeader, userInfo)
        if (stats && stats.followed_kols) {
          await insertKOLFollowers(userInfo, stats)
        }
      } else {
        let Activecode = await getCode()
        statsModal.show(type, userInfo.username, userInfo.userId, Activecode)
      }
    })
  })
}

async function insertKOLFollowers(userInfo, stats) {
  const settings = await chrome.storage.sync.get({
    enableKOLFollowers: true // 默认开启
  })
  if (!settings.enableKOLFollowers) return

  // 查找个人资料时间线导航栏
  const timelineNav = document.querySelector('nav[aria-live="polite"]')
  if (!timelineNav) return

  // 检查是否已存在KOL信息框
  const existingKolBox = document.querySelector('.twitter-kol-followers-box')
  if (existingKolBox) {
    existingKolBox.remove()
  }

  // 创建KOL信息容器
  const kolBox = document.createElement('div')
  kolBox.className = 'twitter-kol-followers-box'
  kolBox.dataset.username = userInfo.username
  kolBox.dataset.userId = userInfo.userId || ''

  const colorScheme = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim()

  const themeStyles = {
    light: {
      color: '#536471', // 浅色主题用深灰色
      borderColor: '#EFF3F4',
      itemBg: 'rgba(0, 0, 0, 0.05)',
      itemHoverBg: 'rgba(0, 0, 0, 0.1)'
    },
    dark: {
      color: '#E7E9EA', // 暗色主题用浅色
      borderColor: '#2F3336',
      itemBg: 'rgba(255, 255, 255, 0.1)',
      itemHoverBg: 'rgba(255, 255, 255, 0.2)'
    },
    dim: {
      color: '#F7F9F9', // 蓝色主题用白色
      borderColor: '#38444D',
      itemBg: 'rgba(255, 255, 255, 0.08)',
      itemHoverBg: 'rgba(255, 255, 255, 0.15)'
    }
  }
  const currentTheme = themeStyles[colorScheme] || themeStyles.dark

  const style = document.createElement('style')

  style.textContent = `
	.twitter-kol-followers-box {
		padding: 4px 16px;
		margin-top: 4px;
		border-bottom: 1px solid ${currentTheme.borderColor};
		color: ${currentTheme.color};
		font-size: 15px;
		line-height: 20px;
	}
   .kol-followers-container {
	 display: flex;
	 align-items: center;
	 flex-wrap: wrap;
	 gap: 8px;
   }
   .kol-followers-title {
	 white-space: nowrap;
	 margin-bottom: 4px;
	 color: ${currentTheme.color};
   }
   .kol-followers-list {
	 display: flex;
	 flex-wrap: wrap;
	 gap: 8px;
   }
   .kol-follower-item {
	 display: flex;
	 align-items: center;
	 background: ${currentTheme.itemBg};
	 padding: 4px 8px;
	 border-radius: 16px;
	 cursor: pointer;
	 transition: background-color 0.2s;
	 color: ${currentTheme.color};
   }
   .kol-follower-item:hover {
	 background: ${currentTheme.itemHoverBg};
   }
   .kol-follower-avatar {
	 width: 20px;
	 height: 20px;
	 border-radius: 50%;
	 margin-right: 4px;
   }
   .kol-follower-name {
	 font-size: 13px;
	  color: ${currentTheme.color};
   }
 `
  document.head.appendChild(style)

  // 构建HTML内容
  kolBox.innerHTML = `
	  <div class="kol-followers-title">
		关注ta的KOL(${stats.followed_kol_count}个):
	  </div>
	  <div class="kol-followers-list">
		${stats.followed_kols
      .map(
        kol => `
		  <div class="kol-follower-item" data-screen-name="${kol.screen_name}">
			<img class="kol-follower-avatar" src="${kol.profile_image_url_https}" alt="${kol.name}">
			<span class="kol-follower-name">${kol.title || kol.name}</span>
		  </div>
		`
      )
      .join('')}
	  </div>
	`

  // 在导航栏之前插入KOL信息框
  timelineNav.parentNode.insertBefore(kolBox, timelineNav)

  // 添加点击事件处理
  const followerItems = kolBox.querySelectorAll('.kol-follower-item')
  followerItems.forEach(item => {
    item.addEventListener('click', () => {
      const screenName = item.dataset.screenName
      window.location.href = `https://x.com/${screenName}`
    })
  })
}
//推文详情页插入按钮
const insertButtons = debounce(async () => {
  // 查找标题容器
  try {
    const tweets = document.querySelectorAll('[data-testid="tweet"]')
    //查找所有推文
    if (!tweets) return

    const currentUrl = window.location.href
    //使用正则表达式 match 来提取当前推文的用户名和推文 ID
    const currentUrlMatch = currentUrl.match(/x\.com\/([^/]+)\/status\/(\d+)/)
    if (!currentUrlMatch) return
    const [, currentUsername, currentTweetId] = currentUrlMatch
    //遍历页面上所有的推文元素
    for (const tweet of tweets) {
      //检查并获取用户名容器
      const titleContainer = tweet.querySelector('[data-testid="User-Name"]')
      if (!titleContainer) continue
      //获取用户信息容器
      const p1 = titleContainer.parentElement
      if (!p1) return
      //获取推文的 URL 链接和 ID
      const userNameContainer = p1.parentElement
      if (!userNameContainer) return

      const tweetAs = tweet.querySelectorAll('a[href*="/status/"]')
      if (!tweetAs) continue
      let tweetID = 0
      for (const tweetA of tweetAs) {
        const timeElement = tweetA.querySelector('time')
        if (!timeElement) continue
        tweetID = tweetA.href.split('/status/')[1].split('?')[0].split('/')[0]
      }
      //如果推文 ID 匹配，继续操作
      if (currentTweetId !== tweetID) continue
      // 设置当前推文的 ID 和内容
      currentBtnTweetID = tweetID
      // if (screenName !== currentUsername) return;

      const tweetContent = tweet.querySelector('[data-testid="tweetText"]').textContent
      //检查按钮是否已存在
      const existingButtonBox = tweet.querySelector('.custom-twitter-button')
      if (existingButtonBox) {
        return
      }

      // 创建按钮
      const button1 = document.createElement('button')
      button1.textContent = '收录推文'
      button1.className = 'custom-twitter-button'
      button1.onclick = async () => {
        await postTweet(currentUsername, tweetID, tweetContent)
        button1.remove()
      }

      const button2 = document.createElement('button')
      button2.className = 'custom-twitter-button warning'
      button2.innerHTML = `
    <span style="display: flex; align-items: center; gap: 4px;">
      删推提醒
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M11.996 2c-4.062 0-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958C19.48 5.017 16.054 2 11.996 2zM9.171 18h5.658c-.412 1.165-1.523 2-2.829 2s-2.417-.835-2.829-2z"/>
      </svg>
    </span>
  `
      button2.onclick = async () => {
        await deleteTweetAlert(currentUsername, tweetID)
      }

      // 添加按钮样式
      const style = document.createElement('style')
      style.textContent = `
	  .custom-twitter-button {
		background: rgb(0, 186, 124);
		border: none;
		color: rgb(255, 255, 255);
		padding: 6px 12px;
		border-radius: 16px;
		cursor: pointer;
		margin: 0 4px;
		font-size: 14px;
		font-weight: 500;
	  }
	  .custom-twitter-button:hover {
		background: rgb(0, 166, 104);
	  }
	  .custom-twitter-button.warning {
		background: rgb(255, 149, 0);  /* Twitter的红色 */
	  }
	  .custom-twitter-button.warning:hover {
		 background: rgb(230, 134, 0);  /* 稍深的橙色 */
	  }
	`
      document.head.appendChild(style)

      // 在用户名后面插入按钮
      userNameContainer.appendChild(button1)
      userNameContainer.appendChild(button2)
    }
  } catch (error) {
    console.error('insertButtons err:', error)
  }
}, 100)

async function postTweet(username, userId, tweet) {
  chrome.runtime.sendMessage({
    action: 'postTweet',
    username,
    userId,
    tweet
  })
}

async function deleteTweetAlert(username, userId, tweet) {
  chrome.runtime.sendMessage({
    action: 'deleteTweetAlert',
    username,
    userId
  })
}
