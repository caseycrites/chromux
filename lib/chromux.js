// notifications

function notify(title, message) {
  chrome.notifications.create(
    "", {type: "basic", title: title, message: message},
    function(id) { console.log(id) }
  )
}

// sessions

var baseSessionKey = "chromux.sessions"
var noSessionKey = baseSessionKey + ".no_session"
  , activeSessionKey = baseSessionKey + ".active"
  , userSessionsKey = baseSessionKey + ".user"
  , sessionsIndexKey = baseSessionKey + ".index"

var sessionsIndex = {loaded: false, keys: []}
var currentSession = {activeTab: 0, urls: []}

function loadSessionIndex() {
  chrome.storage.local.get(sessionsIndexKey, function(obj) {
    sessionsIndex = {loaded: true, keys: obj[sessionsIndexKey]}
  })
}

function saveSessionIndex() {
  if (!sessionsIndex.loaded) return
  chrome.storage.local.set({sessionsIndexKey: sessionsIndex})
}

loadSessionIndex()

function userSession(name) {
  return userSessionsKey + "." + name
}

function getSession(name, callback) {
  if (sessionsIndex.loaded && !sessionsIndex.keys.indexOf(name))
    return callback(null)

  chrome.storage.local.get(name, function(obj) {
    if (!('activeTab' in obj[name])) return callback(null)
    callback(obj[name])
  })
}

function loadSession(session) {
  getCurrentTabs(function(tabs) {

  })
}

function createNewSession(name) {
  getSession(name, function(session) {
    if (session) return notify("Duplicate Session!", name + " is a duplicate session name.")
    // preload the new tab page
    session.urls.push('')
    loadSession(session)
  })
}

function attachToSession(name) {
  getSession(name, function(session) {
    if (!session) return notify("Session Not Found!", name + " is not a valid session name.")
    loadSession(session)
  })
}

function saveCurrentSession(name) {
  // TODO I think I can just listen for the active tab and then just persist currentSession
  getCurrentTabs(function(tabs) {
    var session = {activeTab: 0, urls: []}
    tabs.forEach(function(tab) {
      if (tab.active) session.activeTab = tab.index
      session.urls.push(tab.url)
    })
    chrome.storage.local.set({name: session})
  })
}

// clean up

function flush() {
  saveCurrentSession()
  saveSessionIndex()
}

// commands

var commands = {
  new: {
    description: "Create a new chromux session.",
    handler: createNewSession
  },
  attach: {
    description: "Attach to an existing chromux session.",
    handler: attachToSession
  }
}

function validateCommand(command) {
  if (!(command in commands)) {
    notify("Bad command!", command + " is not a valid chromux command.")
    return false
  }
  return true
}

// suggestion handling

function resetDefaultSuggestion() {
  updateSuggestions(Object.keys(commands))
}

function updateSuggestions(suggestions) {
  chrome.omnibox.setDefaultSuggestion(
    {description: "<dim>" + suggestions.join(", ") + "</dim>"}
  )
}

resetDefaultSuggestion()

// tabs

function getCurrentTabs(callback) {
  chrome.tabs.query({currentWindow: true}, function(tabs) {
    callback(tabs)
  })
}

// omnibox listeners

chrome.omnibox.onInputEntered.addListener(
  function(text, suggest) {
    words = text.split(" ")
    command = words[0]
    if (!validateCommand(command)) return

    commands[command].handler(words.slice(1))
  }
)

chrome.omnibox.onInputChanged.addListener(
  function(text) {
    words = text.split(" ")
    command = words[0]
    // TODO if the command is valid, ask the command for suggestions
  }
)

// tab listeners

chrome.tabs.onUpdated.addListener(
  function(tabId, changeInfo, tab) {
    // TODO update the current session and index
  }
)
