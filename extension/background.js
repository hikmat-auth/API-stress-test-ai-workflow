// Service worker — relays messages between devtools panel and tabs
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: msg.url }, (tab) => sendResponse({ tabId: tab.id }));
    return true;
  }
  if (msg.type === 'GET_COOKIES') {
    chrome.cookies.getAll({ url: msg.url }, (cookies) => sendResponse({ cookies }));
    return true;
  }
});
