var chromux = {
  getCurrentTabs: function(callback) {
    chrome.tabs.query({}, callback)
  },

  closeCurrentTabs: function(callback) {
    chromux.getCurrentTabs(function(tabs) {
      tabIds = []
      tabs.forEach(function(tab) {
        tabIds.push(tab.id)
      })
      chrome.tabs.remove(tabIds, callback)
    })
  },

  saveSession: function(sessionName, callback) {
    chromux.getCurrentTabs(function(tabs) {
      urls = []
      tabs.forEach(function(tab) {
        urls.push(tab.url)
      })
      names = localStorage["chromux.sessions.names"]
      if (names)
        names = JSON.parse(names)
      else
        names = []
      names.push(sessionName)
      localStorage["chromux.sessions.names"] = JSON.stringify(names)
      localStorage["chromux.sessions." + sessionName] = JSON.stringify(urls)
    })
  },

  loadSession: function(sessionName, callback) {
    session = JSON.parse(localStorage["chromux.sessions." + sessionName])
    chromux.closeCurrentTabs(function() {
      session.forEach(function(url) {
        console.warn(url)
        chrome.tabs.create({url: url})
      })
      chromux.notify("Session Loaded", "Successfully loaded " + sessionName)
    })
  },

  deleteSession: function(sessionName, callback) {
    localStorage.removeItem("chromux.sessions." + sessionName)
  },

  getAllSessions: function(callback) {
    names = localStorage["chromux.sessions.names"]
    sessions = []
    if (names) {
      names = JSON.parse(names)
      names.forEach(function(name) {
        sessions.push({name: name, urls: JSON.parse(localStorage["chromux.sessions."+name])})
      })
    }
    callback(sessions)
  },

  populateSessionList: function() {
    chromux.getAllSessions(function(sessions) {
      if (sessions) {
        div = document.createElement("div")
        div.id = "chromux-session-list"
        document.querySelector("#content").appendChild(div)
        list = document.createElement("ul")
        div.appendChild(list)
        sessions.forEach(function(session) {
          item = document.createElement("li")
          link = document.createElement("a")
          link.id = session.name
          link.innerText = session.name
          link.href = "#"

          link.addEventListener('click', function() {
            chromux.loadSession(link.innerText)
          })

          item.appendChild(link)
          list.appendChild(item)
        })
      }
    })
  },

  notify: function(title, message) {
    if (window.webkitNotifications.checkPermission() == 0) {
      window.webkitNotifications.createNotification(
        '../images/glyphicons_156_show_thumbnails.png', title, message
      ).show()
    } else {
      window.webkitNotifications.requestPermission()
    }
  },

  getSessionName: function(callback) {
    content = document.querySelector("#content")
    command_list = document.querySelector("#chromux-command-list")
    holder = document.createElement("div")
    holder.innerHTML = "<input placeHolder='New session name' id='chromux-session-name'><br><button id='chromux-submit-button'>Submit</button><button id='chromux-cancel-button'>Cancel</button>"

    revertView = function() {
      content.removeChild(holder)
      command_list.hidden = false
    }

    command_list.hidden = true
    content.appendChild(holder)

    document.querySelector("#chromux-submit-button").addEventListener('click', function() {
      sessionName = document.querySelector("#chromux-session-name").value
      if (sessionName.length != 0) {
        revertView()
        callback(sessionName)
      }
    })

    document.querySelector("#chromux-cancel-button").addEventListener('click', function() {
      revertView()
    })
  }
}

chromux.populateSessionList()

document.querySelector("#chromux-save-session").addEventListener("click",
  function() {
    chromux.getSessionName(chromux.saveSession)
  }, false)
