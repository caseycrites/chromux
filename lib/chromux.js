// urls
var newTabUrl = "chrome://newtab/"

// namespace of storage
var baseSessionKey = "chromux.sessions"

// specific keys or namespaces of sessions an index
var noSessionKey = baseSessionKey + ".no_session"
  , activeSessionKey = baseSessionKey + ".active"
  , userSessionsKey = baseSessionKey + ".user"
  , sessionsIndexKey = baseSessionKey + ".index"

// An index of saved user session names
var sessionsIndex = {loaded: false, keys: []}

// The current active session
var currentSession

// commands

var commands
function defineCommands() {
  commands = {
    new: {
      description: "Create a new chromux session.",
      handler: createNewSession
    },
    attach: {
      description: "Attach to an existing chromux session.",
      handler: logger
    },
    detach: {
      description: "Detach from the current chromux session.",
      handler: logger
    },
    delete: {
      description: "Delete an existing chromux session.",
      handler: logger
    }
  }
}

// given a command, confirm it's valid
function validateCommand(command) {
  if (!(command in commands)) {
    notify(command + " is not a valid chromux command.")
    return false
  }
  return true
}

function clearChrome() {
  getCurrentWindows().then(function(windows) {
    windows.forEach(function(window) {
      if (!window.focused) {
        chrome.windows.remove(window.id)
      } else {
        chrome.tabs.remove(window.tabs.slice(1).map(function(tab) {return tab.id}))
        chrome.tabs.update(window.tabs[0].id, {url: newTabUrl, active: true})
      }
    })
  })
}

function saveCurrentSession() {
  var sessionObj = {}
  sessionObj[currentSession.name] = currentSession
  return store(sessionObj)
}

function createNewSession(name) {
  if (Array.isArray(name))
    name = name[0]
  name = userSessionsKey + "." + name
  console.log("creating new session with name", name)
  saveCurrentSession().then(function() {
    currentSession.name = name
    clearChrome()
  })
}

function buildCurrentSession() {
  getCurrentWindows().then(function(currWindows) {
    var session = {name: noSessionKey, focusedWindow: -1, activeTab: -1, windows: {}, tabs: {}}
    currWindows.forEach(function(currWindow) {
      var windowObj = {tabs: []}
      session.windows[currWindow.id] = windowObj
      if (currWindow.focused) session.focusedWindow = currWindow.id

      currWindow.tabs.forEach(function(currTab) {
        var tabObj = {url: currTab.url, pinned: currTab.pinned, windowId: currWindow.id}
        session.tabs[currTab.id] = tabObj
        if (currTab.active) session.activeTab = currTab.id
        windowObj.tabs.push(currTab.id)
      })
    })
    currentSession = session
  })
}

// suggestion handling

// reset omnnibox suggestion to command list
function resetDefaultSuggestion() {
  updateSuggestions(Object.keys(commands))
}

// set omnibox suggestion
function updateSuggestions(suggestions) {
  chrome.omnibox.setDefaultSuggestion(
    {description: "<dim>" + suggestions.join(", ") + "</dim>"}
  )
}

// windows

function getSessionWindow(windowId) {
  return currentSession.windows[windowId]
}

// get current windows
function getCurrentWindows() {
  return new Promise(function(resolve, reject) {
    chrome.windows.getAll({populate: true}, resolve)
  })
}

// get a specified window
function getWindow(windowId) {
  return new Promise(function(resolve, reject) {
    chrome.windows.get(windowId, {populate: true}, resolve)
  })
}

// remove specified window from session
function removeWindowFromSession(windowId) {
  if (!(windowId in currentSession.windows)) return

  var windowObj = currentSession.windows[windowId]
  windowObj.tabs.forEach(function(tabId) { removeTabFromSession(tabId, windowId) })
  delete currentSession.windows[windowId]
}

// add specified window to session
function addWindowToSession(newWindow) {
  var windowObj = {tabs: []}
  currentSession.windows[newWindow.id] = windowObj
  if (newWindow.focused) currentSession.focusedWindow = newWindow.id

  newWindow.tabs.forEach(function(tab) {
    addTabToSession(tab)
  })
}

// tabs

function getSessionTab(tabId) {
  return currentSession.tabs[tabId]
}

// get a specified tab
function getTab(tabId) {
  return new Promise(function(resolve, reject) {
    chrome.tabs.get(tabId, resolve)
  })
}

// add specified tab to session
function addTabToSession(tab) {
  var tabObj = {url: tab.url, windowId: tab.windowId, pinned: tab.pinned}
  currentSession.tabs[tab.id] = tabObj
  addTabToWindow(tab)

  if (tab.active) currentSession.activeTab = tab.id
}

// add tab to window's tabs
function addTabToWindow(tab) {
  var sessWindow = getSessionWindow(tab.windowId)
  if (!sessWindow) return

  var existingIndex = sessWindow.tabs.indexOf(tab.id)
  if (existingIndex >= 0 && existingIndex !== tab.index) {
    moveTab(tab.id, tab.windowId, existingIndex, tab.index)
  } else if (existingIndex < 0) {
    sessWindow.tabs.splice(tab.index, 0, tab.id)
  }
}

// remove specified tab from session
function removeTabFromSession(tabId, windowId) {
  removeTabFromWindow(tabId, windowId)
  delete currentSession.tabs[tabId]
}

// remove tab from window's tabs
function removeTabFromWindow(tabId, windowId) {
  var sessWindow = getSessionWindow(windowId)
  if (!sessWindow) return

  var tabIndex = sessWindow.tabs.indexOf(tabId)
  if (tabIndex >= 0) sessWindow.tabs.splice(tabIndex, 1)
}

// update tab
function updateTab(updatedTab) {
  var currentTab = getSessionTab(updatedTab.id)
  if (currentTab) {
    currentTab.url = updatedTab.url
    currentTab.pinned = updatedTab.pinned
  } else {
    addTabToSession(updatedTab)
  }
}

// activate tab
function activateTab(activatedTabId) {
  currentSession.activeTab = activatedTabId
}

// move tab
function moveTab(tabId, windowId, fromIndex, toIndex) {
  var sessWindow = getSessionWindow(windowId)
  sessWindow.tabs.splice(fromIndex, 1)
  sessWindow.tabs.splice(toIndex, 0, tabId)
}

// omnibox listeners

chrome.omnibox.onInputEntered.addListener(function(text, suggest) {
  words = text.split(" ")
  command = words[0]
  if (!validateCommand(command)) return

  commands[command].handler(words.slice(1))
})

chrome.omnibox.onInputChanged.addListener(function(text) {
  words = text.split(" ")
  command = words[0]
  // TODO if the command is valid, ask the command for suggestions
})

// tab listeners

chrome.tabs.onCreated.addListener(addTabToSession)

chrome.tabs.onRemoved.addListener(function(removedTabId, removeInfo) {
    if (removeInfo.isWindowClosing) return
    removeTabFromSession(removedTabId, removeInfo.windowId)
})

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, updatedTab) {
  updateTab(updatedTab)
})

chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
  moveTab(tabId, moveInfo.windowId, moveInfo.fromIndex, moveInfo.toIndex)
})

chrome.tabs.onActivated.addListener(function(activatedInfo) {
  activateTab(activatedInfo.tabId)
})

chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
  getTab(tabId).then(addTabToSession)
})

chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {
  removeTabFromSession(tabId, detachInfo.oldWindowId)
})

// window listeners

chrome.windows.onCreated.addListener(function(createdWindow) {
  getWindow(createdWindow.id).then(addWindowToSession)
})
chrome.windows.onRemoved.addListener(removeWindowFromSession)

// app listeners

chrome.runtime.onInstalled.addListener(function(details) { startup() })
chrome.runtime.onStartup.addListener(function(details) { startup() })
chrome.runtime.onSuspend.addListener(function(details) { flush() })

// startup

function startup() {
  defineCommands()
  resetDefaultSuggestion()
  buildCurrentSession()
}

// helpers

function logger(obj) {
  console.log(obj)
}

function notify(message) {
  window.alert(message)
}

function flush() {
  saveCurrentSession()
}

function clear() {
  chrome.storage.sync.clear()
}

function store(obj) {
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.set(obj, function() {
      if (chrome.runtime.lastError)
        reject()
      else
        resolve()
    })
  })
}

function retrieve(name) {
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.get(name, function(obj) {
      if (chrome.runtime.lastError)
        reject()
      else
        resolve(obj)
    })
  })
}
