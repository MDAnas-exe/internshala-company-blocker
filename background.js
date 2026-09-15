async function refreshOpenInternshalaTabs() {
  const tabs = await chrome.tabs.query({
    url: ["https://*.internshala.com/*"]
  });

  await Promise.all(
    tabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) =>
        chrome.tabs.reload(tab.id).catch(() => {
        })
      )
  );
}

chrome.runtime.onInstalled.addListener(() => {
  refreshOpenInternshalaTabs();
});

chrome.runtime.onStartup.addListener(() => {
  refreshOpenInternshalaTabs();
});
