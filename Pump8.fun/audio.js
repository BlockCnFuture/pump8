// audio.js
const audio = document.getElementById('notificationSound')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'playSound') {
    audio.play()
  }
})
