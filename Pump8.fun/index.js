// 默认设置
const defaultSettings = {
  contractPrefix: 'http://gmgn.ai/sol/token/',
  enablePumpFunRedirect: true,
  showGmgnNameHistory: true,
  enableAutoQuery: true,
  code: '',
  enableKOLFollowers: true,
  enableNotificationSound: true
}

let elements
document.addEventListener('DOMContentLoaded', () => {
  elements = {
    contractPrefix: document.getElementById('contractPrefix'),
    code: document.getElementById('activationCode'),
    saveButton: document.getElementById('saveButton'),
    saveStatus: document.getElementById('saveStatus'),
    enableAutoQuery: document.getElementById('enableAutoQuery'),
    enableKOLFollowers: document.getElementById('enableKOLFollowers'),
    enableNotificationSound: document.getElementById('notificationSound')
  }

  loadSettings()

  // 绑定保存按钮事件
  if (elements.saveButton) {
    elements.saveButton.addEventListener('click', saveSettings)
  }
})

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(
    {
      enableKOLFollowers: true // 默认开启
    },
    function (items) {
      document.getElementById('enableKOLFollowers').checked = items.enableKOLFollowers
    }
  )

  chrome.storage.sync.get(defaultSettings, settings => {
    console.log(settings)
    elements.contractPrefix.value = settings.contractPrefix //url input
    elements.code.value = settings.code
    if (elements.code.value) {
      ActiveCode(elements.code.value)
      //自身是激活状态
    }
    if (elements.enableAutoQuery) {
      elements.enableAutoQuery.checked = settings.enableAutoQuery
    }
    if (elements.enableKOLFollowers) {
      elements.enableKOLFollowers.checked = settings.enableKOLFollowers
    }
    if (elements.enableNotificationSound) {
      elements.enableNotificationSound.checked = settings.enableNotificationSound
    }
  })

  const activateButton = document.getElementById('activateButton')
  //给激活按钮绑定事件
  if (activateButton) {
    activateButton.addEventListener('click', () => {
      ActiveCode(elements.code.value)
      //输入激活码状态
    })
  }
  //给保存按钮绑定事件
  const saveButton = document.getElementById('saveButton')
  if (saveButton) {
    saveButton.addEventListener('click', saveSettings)
  }
}

function saveSettings() {
  const settings = {
    contractPrefix: elements.contractPrefix.value,
    enableAutoQuery: elements.enableAutoQuery.checked,
    enableKOLFollowers: elements.enableKOLFollowers.checked,
    enableNotificationSound: elements.enableNotificationSound.checked
  }

  chrome.storage.sync.set(settings, () => {
    elements.saveStatus.classList.add('show')
    setTimeout(() => {
      elements.saveStatus.classList.remove('show')
    }, 2000)
  })
}

async function ActiveCode(code) {
  if (!code) {
    return
  }
  const activationStatus = document.getElementById('activationStatus')

  try {
    const activationCode = document.getElementById('activationCode').value
    var raw = ''

    var requestOptions = {
      method: 'POST',
      body: raw,
      redirect: 'follow'
    }
    //激活激活码
    fetch(`https://fuckscam.com/api/v1/pump8/active?Activation=${activationCode}`, requestOptions)
      .then(response => response.text())
      .then(result => {
        const data = JSON.parse(result)
        console.log(data)
        if (data.code !== 1) {
          activationStatus.textContent = data.msg
          activationStatus.className = 'activation-status error'
        } else {
          chrome.storage.sync.set({ code: activationCode })
          activationStatus.textContent = '剩余天数:' + (data.data.expire_at === '' ? '永久' : data.data.expire_at)
          activationStatus.className = 'activation-status success'
        }
      })
      .catch(error => console.log('error', error))
  } catch (error) {
    alert(error.message)
  }
}
//删除推文提示
async function handleDeleteTweetAlert(id) {
  try {
    const activationCode = document.getElementById('activationCode').value //激活码
    const response = await fetch(`https://pumpscam.com/api/v1/pumpPill/DeleteTweetAlert/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Code': activationCode
      }
    })

    const data = await response.json()
  } catch (error) {
    console.error('删除失败:', error)
    sendResponse({ error: error.message })
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', loadSettings)
