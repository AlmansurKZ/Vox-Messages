document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const body = document.body;

  const ageLabels = {
    child: "Ребёнок",
    teen: "Подросток",
    adult: "Взрослый"
  };

  const ageHints = {
    child: "🦔 Не делись личными данными и общайся только с теми, кому доверяешь.",
    teen: "⚡ Выполняй квесты, настраивай маскота и делись историями.",
    adult: "💼 Настрой интерфейс и используй удобные инструменты общения."
  };

  const tabTitles = {
    chats: "Чаты",
    stories: "Истории",
    friends: "Друзья",
    mascot: "Маскот",
    quests: "Квесты",
    chests: "Сундуки",
    settings: "Настройки",
    support: "Поддержка"
  };

  let username = "Пользователь";
  let userHandle = "@username";
  // У каждого профиля свой набор ключей в localStorage.
  let activeAccountId = "guest";
  let coins = 0;

  let storyImage = "";
  let storyFilter = "none";
  let editingStory = null;
  let toastTimeout;

  // ------------------------------
  // ХРАНЕНИЕ НАСТРОЕК
  // ------------------------------

  function readSetting(key, fallback = "") {
    try {
      return localStorage.getItem("vox-account-" + activeAccountId + "-" + key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readNumber(key, fallback) {
    const value = Number(readSetting(key, String(fallback)));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function saveSetting(key, value) {
    try {
      localStorage.setItem("vox-account-" + activeAccountId + "-" + key, String(value));
      return true;
    } catch {
      showToast("Не удалось сохранить настройку в браузере.");
      return false;
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) {
      alert(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // ------------------------------
  // РЕГИСТРАЦИЯ
  // ------------------------------

  const registerForm = $("#register-form");

  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#reg-name").value.trim();
    const handleInput = $("#reg-username").value.trim();
    const password = $("#reg-password").value;
    const age = $("#reg-age").value;

    if (!name || !handleInput || password.length < 6) {
      showToast("Заполни поля. Пароль должен содержать минимум 6 символов.");
      return;
    }

    if (!ageLabels[age]) {
      showToast("Выбери возрастную категорию.");
      return;
    }

    username = name;
    userHandle = handleInput.startsWith("@")
      ? handleInput
      : "@" + handleInput;

    // Идентификатор аккаунта отделяет его аватар, монеты, квесты и настройки.
    activeAccountId = userHandle.slice(1).toLowerCase();
    coins = readNumber("coins", 0);
    friends = readFriends();

    $("#display-name").textContent = username;
    $("#display-username").textContent = userHandle;

    saveSetting("username", username);
    saveSetting("handle", userHandle);

    updateAgeMode(readSetting("age", age));

    // Восстанавливаем данные именно этого профиля.
    avatarImage.src = readSetting("avatar", "") || "https://placehold.co/120x120/302050/ffffff?text=V";
    applyTheme(readSetting("theme", "dark"));
    styleSelect.value = readSetting("style", "modern");
    body.dataset.style = styleSelect.value;
    applyFrame(readSetting("frame", "frame-none"));
    skinSelect.value = readSetting("mascot-skin", "body-fox");
    updateMascot();
    renderFriends();
    updateCoins();

    ["message", "story", "mascot"].forEach((id) => {
      const button = document.querySelector('[data-quest-id="' + id + '"]');
      const claimed = readSetting("quest-" + id, "available") === "claimed";
      if (button) {
        const ready = readSetting("quest-progress-" + id, "0") === "1";
        button.disabled = claimed || !ready;
        button.textContent = claimed ? "Получено ✓" : ready ? "Забрать " + button.dataset.reward + " 🪙" : "Выполни задание";
      }
    });

    $("#auth-screen").classList.remove("active");
    $("#app-screen").classList.add("active");

    // Пароль намеренно не сохраняется в браузере.
    // Для настоящих аккаунтов нужен сервер с безопасной авторизацией.

    showToast("Добро пожаловать в Vox!");
  });

  function updateAgeMode(age) {
    if (!ageLabels[age]) return;

    body.dataset.ageGroup = age;

    const ageBadge = $("#display-age-badge");
    const chatAgeSelect = $("#chat-age-select");
    const settingsAgeSelect = $("#settings-age-select");
    const hint = $("#age-hint-banner");

    if (ageBadge) ageBadge.textContent = ageLabels[age];
    if (chatAgeSelect) chatAgeSelect.value = age;
    if (settingsAgeSelect) settingsAgeSelect.value = age;

    if (hint) {
      const span = hint.querySelector("span");
      if (span) {
        span.textContent = ageHints[age];
      } else {
        hint.textContent = ageHints[age];
      }
    }

    saveSetting("age", age);
  }

  $("#chat-age-select").addEventListener("change", (event) => {
    updateAgeMode(event.target.value);
  });

  $("#settings-age-select").addEventListener("change", (event) => {
    updateAgeMode(event.target.value);
  });

  // ------------------------------
  // НАВИГАЦИЯ
  // ------------------------------

  $$(".nav-btn[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;
      const targetTab = $("#tab-" + tabName);

      if (!targetTab) return;

      $$(".nav-btn").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      $$(".tab-content").forEach((tab) => {
        tab.classList.toggle("active", tab === targetTab);
      });

      $("#page-title").textContent = tabTitles[tabName] || "Vox";
    });
  });

  // ------------------------------
  // ТЁМНАЯ И СВЕТЛАЯ ТЕМЫ
  // ------------------------------

  function applyTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";

    body.dataset.theme = selectedTheme;
    saveSetting("theme", selectedTheme);

    const label = selectedTheme === "dark"
      ? "☀️ Светлая тема"
      : "🌙 Тёмная тема";

    const themeButton = $("#toggle-theme-btn");
    const settingsThemeButton = $("#settings-theme-btn");

    if (themeButton) themeButton.textContent = label;
    if (settingsThemeButton) settingsThemeButton.textContent = label;
  }

  function toggleTheme() {
    applyTheme(body.dataset.theme === "dark" ? "light" : "dark");
  }

  $("#toggle-theme-btn").addEventListener("click", toggleTheme);
  $("#settings-theme-btn").addEventListener("click", toggleTheme);

  applyTheme(readSetting("theme", "dark"));

  // ------------------------------
  // СТИЛЬ ИНТЕРФЕЙСА
  // ------------------------------

  const styleSelect = $("#style-select");

  styleSelect.value = readSetting("style", "modern");
  body.dataset.style = styleSelect.value;

  styleSelect.addEventListener("change", () => {
    body.dataset.style = styleSelect.value;
    saveSetting("style", styleSelect.value);
  });

  // ------------------------------
  // СМЕНА АВАТАРКИ
  // ------------------------------

  const avatarInput = $("#avatar-upload");
  const avatarImage = $("#user-avatar");

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Выбери файл изображения.");
      avatarInput.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast("Размер аватарки должен быть не больше 2 МБ.");
      avatarInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      const oldSrc = avatarImage.src;
      avatarImage.src = reader.result;

      if (!saveSetting("avatar", reader.result)) {
        avatarImage.src = oldSrc;
      } else {
        showToast("Аватарка изменена!");
      }
    };

    reader.onerror = () => showToast("Не удалось прочитать изображение.");
    reader.readAsDataURL(file);
  });

  // ------------------------------
  // РАМКА АВАТАРКИ
  // ------------------------------

  const frameSelect = $("#frame-select");
  const avatarFrame = $("#user-avatar-frame");

  function applyFrame(frame) {
    const allowedFrames = ["frame-none", "frame-gold", "frame-neon"];
    const safeFrame = allowedFrames.includes(frame) ? frame : "frame-none";

    avatarFrame.classList.remove(...allowedFrames);
    avatarFrame.classList.add(safeFrame);
    frameSelect.value = safeFrame;
  }

  applyFrame(readSetting("frame", "frame-none"));

  frameSelect.addEventListener("change", () => {
    applyFrame(frameSelect.value);
    saveSetting("frame", frameSelect.value);
  });

  // ------------------------------
  // ЧАТЫ
  // ------------------------------

  const chatForm = $("#chat-send-form");
  const chatInput = $("#chat-input-text");
  const messagesList = $("#messages-list");
  const currentChatName = $("#current-chat-name");

  function formatMessageTime(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function addMessageTime(message, date = new Date()) {
    const time = document.createElement("time");
    time.className = "message-time";
    time.dateTime = date.toISOString();
    time.textContent = formatMessageTime(date);
    message.appendChild(time);
  }

  messagesList.querySelectorAll(".message").forEach((message) => {
    const messageText = document.createElement("span");
    messageText.className = "message-text";
    messageText.textContent = message.textContent;
    message.replaceChildren(messageText);
    addMessageTime(message);
  });

  let activeChat = "Алекс";
  let activeIsGroup = false;
  let sentMessageCount = readNumber("sent-message-count", 0);
  let chatHistories = readChatHistories();

  function readChatHistories() {
    try {
      const value = JSON.parse(readSetting("chat-histories", "{}"));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function saveVisibleChat() {
    const key = activeChat.trim().toLowerCase();
    chatHistories[key] = Array.from(messagesList.querySelectorAll(".message")).map((item) => ({
      type: item.classList.contains("outgoing") ? "outgoing" : "incoming",
      text: item.querySelector(".message-text")?.textContent || "",
      time: item.querySelector("time")?.dateTime || new Date().toISOString()
    }));
    saveSetting("chat-histories", JSON.stringify(chatHistories));
  }

  function loadChatHistory(name) {
    const history = chatHistories[String(name).trim().toLowerCase()];
    messagesList.replaceChildren();

    if (Array.isArray(history)) {
      history.forEach((item) => {
        if (item && typeof item.text === "string") {
          addMessage(item.text, item.type === "outgoing" ? "outgoing" : "incoming", item.time, false);
        }
      });
    } else if (name === "Алекс") {
      addMessage("Привет! Добро пожаловать в Vox 👋", "incoming", null, false);
      addMessage("Уже выбрал своего маскота?", "incoming", null, false);
      saveVisibleChat();
    } else {
      addMessage(activeIsGroup ? "Групповая беседа «" + name + "» создана. Можно общаться!" : "Ты открыл демонстрационный чат: " + name, "incoming", null, false);
      saveVisibleChat();
    }
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function renderGroupMembers(chatButton) {
    const icons = $("#group-member-icons");
    const subtitle = $("#chat-subtitle");
    const group = chatButton.dataset.chatType === "group";
    icons.replaceChildren(); icons.hidden = !group;
    if (subtitle) subtitle.textContent = group ? "Групповая беседа" : "Демонстрационный чат";
    if (group) (chatButton.dataset.members || "👤,👤").split(",").forEach(symbol => {
      const item = document.createElement("span"); item.className = "group-member-icon";
      item.textContent = symbol; icons.appendChild(item);
    });
  }

  function attachOwnMessageMenu(message) {
    const tools = document.createElement("div");
    tools.className = "message-tools";
    const more = document.createElement("button");
    more.type = "button";
    more.className = "message-more-btn";
    more.textContent = "⋯";
    more.title = "Действия с моим сообщением";
    tools.appendChild(more);

    more.addEventListener("click", () => {
      const existing = tools.querySelector(".message-menu");
      if (existing) { existing.remove(); return; }

      const menu = document.createElement("div");
      menu.className = "message-menu";
      const action = (label, callback) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", callback);
        menu.appendChild(button);
      };

      action("✏️ Изменить", () => {
        const textNode = message.querySelector(".message-text");
        const value = prompt("Измени своё сообщение:", textNode.textContent);
        if (value === null || !value.trim()) return;
        textNode.textContent = value.trim().slice(0, 1000);
        menu.remove();
        saveVisibleChat();
        completeQuest("edit");
        showToast("Сообщение изменено.");
      });

      action("📋 Копировать", async () => {
        try {
          await navigator.clipboard.writeText(message.querySelector(".message-text").textContent);
          showToast("Сообщение скопировано.");
        } catch {
          showToast("Браузер не разрешил копирование.");
        }
        menu.remove();
      });

      action("🗑️ Удалить у меня", () => {
        if (!confirm("Удалить это сообщение только у тебя?")) return;
        message.remove();
        saveVisibleChat();
        completeQuest("delete");
        showToast("Сообщение удалено у тебя.");
      });

      tools.appendChild(menu);
    });
    message.appendChild(tools);
  }

  function addMessage(text, type = "outgoing", savedTime = null, shouldSave = true) {
    const message=document.createElement("div"); message.className="message "+type;
    if(type==="outgoing") {
      const line=document.createElement("span"); line.className="message-author-line";
      const avatar=document.createElement("img"); avatar.className="message-avatar"; avatar.alt="Аватар "+username;
      avatar.src=readSetting("avatar","") || "https://placehold.co/64x64/302050/ffffff?text=V";
      const author=document.createElement("strong"); author.className="message-author"; author.textContent=username;
      line.append(avatar,author);
      const textNode=document.createElement("span"); textNode.className="message-text"; textNode.textContent=text;
      message.append(line,textNode);
    } else {
      const textNode=document.createElement("span"); textNode.className="message-text"; textNode.textContent=text; message.appendChild(textNode);
    }
    const date = savedTime ? new Date(savedTime) : new Date();
    addMessageTime(message, Number.isNaN(date.getTime()) ? new Date() : date);
    if(type==="outgoing") attachOwnMessageMenu(message);
    messagesList.appendChild(message);
    messagesList.scrollTop=messagesList.scrollHeight;
    if (shouldSave) saveVisibleChat();
  }

  function selectChat(button) {
    $$(".chat-item").forEach(item=>item.classList.toggle("active",item===button));
    activeChat=button.dataset.chatName; activeIsGroup=button.dataset.chatType==="group";
    currentChatName.textContent=activeChat;
    renderGroupMembers(button);
    loadChatHistory(activeChat);
  }

  chatForm.addEventListener("submit",event=>{
    event.preventDefault(); const text=chatInput.value.trim(); if(!text)return;
    addMessage(text);
    chatInput.value="";
    sentMessageCount++;
    saveSetting("sent-message-count", sentMessageCount);
    if (messageCharCount) messageCharCount.textContent = "0";
    completeQuest("message");
    if(sentMessageCount>=5) completeQuest("five-messages");
  });
  $$(".chat-item").forEach(button=>button.addEventListener("click",()=>selectChat(button)));

  const chatSearchInput = $("#chat-search-input");
  if (chatSearchInput) {
    chatSearchInput.addEventListener("input", () => {
      const query = chatSearchInput.value.trim().toLowerCase();
      $$(".chat-item").forEach((item) => {
        const title = item.querySelector("strong")?.textContent.toLowerCase() || "";
        const preview = item.querySelector("small")?.textContent.toLowerCase() || "";
        item.hidden = !title.includes(query) && !preview.includes(query);
      });
    });
  }

  const messageCharCount = $("#message-char-count");
  chatInput.addEventListener("input", () => {
    if (messageCharCount) messageCharCount.textContent = String(chatInput.value.length);
  });

  $("#new-chat-btn").addEventListener("click",()=>{
    const name=prompt("Как назвать новый демонстрационный чат?"); if(!name||!name.trim())return;
    const button=document.createElement("button"); button.className="chat-item"; button.dataset.chatName=name.trim().slice(0,40);
    const avatar=document.createElement("span"); avatar.className="chat-avatar"; avatar.textContent="💬";
    const box=document.createElement("span"); box.className="chat-item-text";
    const title=document.createElement("strong"); title.textContent=button.dataset.chatName;
    const sub=document.createElement("small"); sub.textContent="Новый чат"; box.append(title,sub); button.append(avatar,box);
    $(".chat-list").appendChild(button); button.addEventListener("click",()=>selectChat(button)); button.click();
  });

  $("#new-group-btn").addEventListener("click",()=>{
    const name=prompt("Название группы:"); if(!name||!name.trim())return;
    const raw=prompt("Участники через запятую (например: Алекс, Мира, Даня):","Алекс, Мира");
    const names=(raw||"Участник 1, Участник 2").split(",").map(x=>x.trim()).filter(Boolean).slice(0,8);
    const symbols=["🦊","🐱","🐼","🐸","🐻","🐯","🐰","🐨"];
    const button=document.createElement("button"); button.className="chat-item"; button.dataset.chatName=name.trim().slice(0,40);
    button.dataset.chatType="group"; button.dataset.members=names.map((_,i)=>symbols[i]).join(",");
    const avatar=document.createElement("span"); avatar.className="chat-avatar"; avatar.textContent="👥";
    const box=document.createElement("span"); box.className="chat-item-text";
    const title=document.createElement("strong"); title.textContent=button.dataset.chatName;
    const sub=document.createElement("small"); sub.textContent=names.length+" участников";
    box.append(title,sub); button.append(avatar,box); $(".chat-list").appendChild(button);
    button.addEventListener("click",()=>selectChat(button)); button.click(); completeQuest("group");
  });

  $("#chat-options-btn").addEventListener("click",()=>{
    const action=prompt("Действия чата:\n1 — Очистить переписку у себя\n2 — Информация о чате");
    if(action==="1"&&confirm("Очистить сообщения только в твоём окне?")) {
      messagesList.replaceChildren();
      saveVisibleChat();
      showToast("Переписка очищена у тебя.");
    } else if(action==="2") {
      showToast((activeIsGroup?"Группа: ":"Личный чат: ")+activeChat);
    }
  });

  // ------------------------------
  // ДРУЗЬЯ (локальная демоверсия)
  // ------------------------------

  const friendsForm = $("#add-friend-form");
  const friendInput = $("#friend-name-input");
  const friendsList = $("#friends-list");
  const friendsCount = $("#friends-count");

  function readFriends() {
    try {
      const parsed = JSON.parse(readSetting("friends", "[]"));
      return Array.isArray(parsed)
        ? parsed.filter((friend) => friend && typeof friend.name === "string")
        : [];
    } catch {
      return [];
    }
  }

  let friends = readFriends();

  function renderFriends() {
    friendsList.replaceChildren();
    friendsCount.textContent = `${friends.length} ${friends.length === 1 ? "друг" : friends.length >= 2 && friends.length <= 4 ? "друга" : "друзей"}`;

    if (friends.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted friends-empty";
      empty.textContent = "Пока здесь никого нет. Добавь первого друга!";
      friendsList.appendChild(empty);
      return;
    }

    friends.forEach((friend, index) => {
      const item = document.createElement("div");
      item.className = "friend-item";

      const avatar = document.createElement("span");
      avatar.className = "friend-avatar";
      avatar.textContent = "👤";

      const info = document.createElement("div");
      info.className = "friend-info";
      const name = document.createElement("strong");
      name.textContent = friend.name;
      const handle = document.createElement("small");
      handle.className = "muted";
      handle.textContent = friend.handle || "Добавлен в друзья";
      info.append(name, handle);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-secondary friend-remove-btn";
      remove.textContent = "Удалить";
      remove.setAttribute("aria-label", `Удалить ${friend.name} из друзей`);
      remove.addEventListener("click", () => {
        friends.splice(index, 1);
        saveSetting("friends", JSON.stringify(friends));
        renderFriends();
        showToast("Друг удалён из списка.");
      });

      item.append(avatar, info, remove);
      friendsList.appendChild(item);
    });
  }

  friendsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const entered = friendInput.value.trim();
    if (!entered) return;

    const normalized = entered.startsWith("@") ? entered.toLowerCase() : entered.toLowerCase();
    const ownValues = [username.toLowerCase(), userHandle.toLowerCase()];
    if (ownValues.includes(normalized)) {
      showToast("Нельзя добавить самого себя.");
      return;
    }

    if (friends.some((friend) => friend.name.toLowerCase() === normalized || (friend.handle || "").toLowerCase() === normalized)) {
      showToast("Этот пользователь уже есть в списке друзей.");
      return;
    }

    const isHandle = entered.startsWith("@");
    friends.push({ name: isHandle ? entered.slice(1) : entered, handle: isHandle ? entered : "" });
    if (saveSetting("friends", JSON.stringify(friends))) {
      friendInput.value = "";
      renderFriends();
      showToast("Друг добавлен в список!");
    }
  });

  renderFriends();

  // ------------------------------
  // МАСКОТ
  // ------------------------------

  const skinSelect = $("#mascot-skin-select");
  const mascotImage = $("#mascot-image");
  const mascotPlaceholder = $("#mascot-placeholder");
  const mascotName = $("#mascot-name");
  const mascotRole = $("#mascot-role");
  const mascotAssets = {
    "body-fox": {
      src: "assets/fox.png", name: "Лиса", emoji: "🦊",
      personality: "✨ Всегда готова помочь и поддержать."
    },
    "body-rabbit": {
      src: "assets/rabbit.png", name: "Заяц", emoji: "🐰",
      personality: "✨ Всегда весёлый и делится хорошим настроением."
    },
    "body-robot": {
      src: "assets/robot.png", name: "Робот", emoji: "🤖",
      personality: "✨ Всегда рассудительный, спокойный и логичный."
    },
    "body-wolf": {
      src: "assets/wolf.png", name: "Волк", emoji: "🐺",
      personality: "✨ Хладнокровный, собранный и сохраняет спокойствие."
    }
  };

  mascotImage.addEventListener("load", () => {
    mascotPlaceholder.hidden = true;
  });

  mascotImage.addEventListener("error", () => {
    mascotImage.hidden = true;
    mascotPlaceholder.hidden = false;
  });

  function updateMascot() {
    const skin = Object.prototype.hasOwnProperty.call(mascotAssets, skinSelect.value)
      ? skinSelect.value
      : "body-fox";
    const mascot = mascotAssets[skin];

    skinSelect.value = skin;
    mascotPlaceholder.textContent = mascot.emoji;
    mascotPlaceholder.hidden = true;
    mascotImage.hidden = false;
    mascotImage.src = mascot.src;
    mascotImage.alt = "Маскот — " + mascot.name;
    mascotImage.title = "Твой маскот — " + mascot.name;
    const mascotName = $("#mascot-name");
    const mascotRole = $("#mascot-role");
    if (mascotName) mascotName.textContent = mascot.name;
    if (mascotRole) mascotRole.textContent = mascot.personality;
    saveSetting("mascot-skin", skin);
  }

  skinSelect.value = readSetting("mascot-skin", "body-fox");

  skinSelect.addEventListener("change", updateMascot);

  updateMascot();

  // ------------------------------
  // МОНЕТЫ И КВЕСТЫ
  // ------------------------------

  function updateCoins() {
    $("#coin-balance").textContent = String(coins);
    $("#chest-coin-balance").textContent = String(coins);
    saveSetting("coins", coins);
  }

  function completeQuest(id) {
    saveSetting("quest-progress-" + id, "1");
    const button = document.querySelector('[data-quest-id="' + id + '"]');
    if (!button || readSetting("quest-" + id, "available") === "claimed") return;
    button.disabled = false;
    button.classList.add("quest-ready");
    button.textContent = "Забрать " + button.dataset.reward + " 🪙";
  }

  function claimQuest(id) {
    const key = "quest-" + id;
    if (readSetting("quest-progress-" + id, "0") !== "1") {
      showToast("Сначала выполни задание.");
      return;
    }
    if (readSetting(key, "available") === "claimed") {
      showToast("Ты уже забрал награду за этот квест.");
      return;
    }

    const button = document.querySelector('[data-quest-id="' + id + '"]');
    if (!button) return;
    const reward = Number(button.dataset.reward);
    if (!Number.isFinite(reward) || reward <= 0) return;

    coins += reward;
    saveSetting(key, "claimed");
    button.disabled = true;
    button.classList.remove("quest-ready");
    button.textContent = "Получено ✓";
    updateCoins();
    showToast("Получено " + reward + " монет!");
  }

  $$("[data-reward][data-quest-id]").forEach((button) => {
    const id = button.dataset.questId;
    const claimed = readSetting("quest-" + id, "available") === "claimed";
    const ready = readSetting("quest-progress-" + id, "0") === "1";

    button.disabled = claimed || !ready;
    if (claimed) {
      button.textContent = "Получено ✓";
    } else if (ready) {
      button.classList.add("quest-ready");
      button.textContent = "Забрать " + button.dataset.reward + " 🪙";
    } else {
      button.textContent = "Выполни задание";
    }

    button.addEventListener("click", () => claimQuest(id));
  });

  // Приглашение — демонстрация без отправки реального сообщения.
  $("#start-coop-btn").addEventListener("click", async () => {
    const inviteText = "Присоединяйся ко мне в Vox Messenger!";
    try {
      await navigator.clipboard.writeText(inviteText);
      showToast("Текст приглашения скопирован. Отправь его другу!");
    } catch {
      showToast(inviteText);
    }
  });

  // ------------------------------
  // ИСТОРИИ С ФОТОГРАФИЯМИ
  // ------------------------------

  const storyInput = $("#story-image");
  const storyPreview = $("#story-preview");
  const storyText = $("#story-text");
  const storyFilterSelect = $("#story-filter");
  const storyFeed = $("#stories-feed");
  const postStoryButton = $("#post-story-btn");

  function updateStoryPreview() {
    storyPreview.replaceChildren();

    if (!storyImage) {
      const placeholder = document.createElement("span");
      placeholder.className = "muted";
      placeholder.textContent = "Предпросмотр появится здесь";
      storyPreview.appendChild(placeholder);
      return;
    }

    const image = document.createElement("img");
    image.src = storyImage;
    image.alt = "Предпросмотр фотографии";
    image.style.filter = storyFilter;
    storyPreview.appendChild(image);
  }

  storyInput.addEventListener("change", () => {
    const file = storyInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Выбери изображение.");
      storyInput.value = "";
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      showToast("Размер фотографии должен быть не больше 4 МБ.");
      storyInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      storyImage = reader.result;
      updateStoryPreview();
    };

    reader.onerror = () => showToast("Не удалось прочитать фотографию.");
    reader.readAsDataURL(file);
  });

  storyFilterSelect.addEventListener("change", () => {
    storyFilter = storyFilterSelect.value;
    updateStoryPreview();
  });

  function createStoryCard(captionText, imageData, filter) {
    const card = document.createElement("article");
    card.className = "story-card";

    const author = document.createElement("strong");
    author.textContent = username;
    card.appendChild(author);

    if (imageData) {
      const image = document.createElement("img");
      image.src = imageData;
      image.alt = "Фотография из истории";
      image.style.filter = filter || "none";
      card.appendChild(image);
    }

    const caption = document.createElement("p");
    caption.textContent = captionText;
    card.appendChild(caption);

    const time = document.createElement("small");
    time.textContent = "Только что";
    card.appendChild(time);

    const actions = document.createElement("div");
    actions.className = "story-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn-secondary";
    editButton.textContent = "Редактировать";

    editButton.addEventListener("click", () => {
      editingStory = card;
      storyImage = imageData || "";
      storyFilter = filter || "none";

      storyText.value = captionText;
      storyFilterSelect.value = storyFilter;

      updateStoryPreview();
      postStoryButton.textContent = "Сохранить изменения";

      $("#tab-stories").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-secondary";
    deleteButton.textContent = "Удалить";

    deleteButton.addEventListener("click", () => {
      if (confirm("Удалить эту историю?")) {
        card.remove();
        if (editingStory === card) resetStoryEditor();
        showToast("История удалена.");
      }
    });

    actions.append(editButton, deleteButton);
    card.appendChild(actions);

    return card;
  }

  function resetStoryEditor() {
    storyImage = "";
    storyFilter = "none";
    editingStory = null;

    storyText.value = "";
    storyInput.value = "";
    storyFilterSelect.value = "none";
    postStoryButton.textContent = "Опубликовать историю";

    updateStoryPreview();
  }

  $("#clear-story-btn").addEventListener("click", resetStoryEditor);

  postStoryButton.addEventListener("click", () => {
    const caption = storyText.value.trim();

    if (!caption && !storyImage) {
      showToast("Добавь фотографию или напиши подпись.");
      return;
    }

    const card = createStoryCard(caption, storyImage, storyFilter);

    if (editingStory) {
      editingStory.replaceWith(card);
      showToast("История обновлена.");
    } else {
      storyFeed.prepend(card);
      showToast("История опубликована в этом браузере!");
      completeQuest("story");
    }

    resetStoryEditor();
  });

  updateStoryPreview();

  // ------------------------------
  // СУНДУКИ — анимация открытия и коллекция предметов
  // --------------------------------------------------

  const chestResult = $("#chest-result");
  const chestHistory = $("#chest-history");
  const lootOverlay = $("#loot-overlay");
  const lootStage = $("#loot-stage");
  const lootChestImage = $("#loot-chest-image");
  const lootItemWrap = $("#loot-item-wrap");
  const lootItemImage = $("#loot-item-image");
  const lootTitle = $("#loot-title");
  const lootRarity = $("#loot-rarity");
  const lootDescription = $("#loot-description");
  const lootClaimButton = $("#loot-claim-btn");
  const lootClose = $("#loot-close");
  let chestOpening = false;
  let pendingLoot = null;

  const chestImages = {
    "Деревянный сундук": "assets/chest-wood.png",
    "Сундук приключений": "assets/chest-open.png",
    "Кристальный сундук": "assets/chest-crystal.png",
    "Королевский сундук": "assets/chest-royal.png"
  };

  const chestRewards = [
    { name: "Золотая монета", text: "Ты нашёл дополнительную монету!", image: "assets/coin.png", rarity: "ОБЫЧНЫЙ", className: "common", coins: 10 },
    { name: "Фиолетовый кристалл", text: "В коллекцию добавлен сияющий кристалл.", image: "assets/gem-purple.png", rarity: "РЕДКИЙ", className: "rare", coins: 0 },
    { name: "Синяя эссенция", text: "Ты нашёл пузырёк синей эссенции.", image: "assets/potion-blue.png", rarity: "РЕДКИЙ", className: "rare", coins: 0 },
    { name: "Звезда достижений", text: "Новая звезда пополнила твою коллекцию.", image: "assets/star.png", rarity: "ЭПИЧЕСКИЙ", className: "epic", coins: 0 },
    { name: "Медаль Vox", text: "Редкая медаль за удачу!", image: "assets/medal.png", rarity: "ЭПИЧЕСКИЙ", className: "epic", coins: 0 },
    { name: "Свиток приключений", text: "В сундуке лежал загадочный свиток.", image: "assets/scroll.png", rarity: "РЕДКИЙ", className: "rare", coins: 0 },
    { name: "Королевское сердце", text: "Очень редкая находка для коллекции.", image: "assets/heart.png", rarity: "ЛЕГЕНДАРНЫЙ", className: "legendary", coins: 0 },
    { name: "Подарок-сюрприз", text: "Внутри оказался маленький подарок.", image: "assets/gift.png", rarity: "ОБЫЧНЫЙ", className: "common", coins: 5 },
    { name: "Кристалл энергии", text: "Ты нашёл редкий сгусток энергии.", image: "assets/crystal-blue.png", rarity: "ЭПИЧЕСКИЙ", className: "epic", coins: 0 },
    { name: "Книга знаний", text: "Коллекция пополнилась волшебной книгой.", image: "assets/spellbook.png", rarity: "ЛЕГЕНДАРНЫЙ", className: "legendary", coins: 0 }
  ];

  function readInventory() {
    try {
      const saved = JSON.parse(readSetting("loot-inventory", "[]"));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveInventory(items) {
    saveSetting("loot-inventory", JSON.stringify(items));
  }

  function addChestHistory(reward) {
    const item = document.createElement("div");
    item.className = "chest-history-item loot-history-entry";
    const image = document.createElement("img");
    image.src = reward.image;
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = reward.name + " — " + reward.rarity;
    item.append(image, text);
    chestHistory.prepend(item);
  }

  function closeLootDialog() {
    lootOverlay.classList.remove("is-visible");
    lootOverlay.setAttribute("aria-hidden", "true");
    chestOpening = false;
    pendingLoot = null;
    lootClaimButton.disabled = true;
    lootClaimButton.textContent = "Ожидай...";
  }

  function revealLoot(chestName, reward) {
    pendingLoot = reward;
    lootTitle.textContent = "Сундук открыт!";
    lootRarity.textContent = reward.rarity;
    lootRarity.className = "loot-rarity " + reward.className;
    lootDescription.textContent = reward.text;
    lootItemImage.src = reward.image;
    lootItemImage.alt = reward.name;
    lootStage.classList.remove("is-shaking", "is-opening");
    lootStage.classList.add("has-reward");
    lootChestImage.src = chestImages[chestName] || "assets/chest-open.png";
    lootChestImage.classList.add("is-hidden");
    lootItemWrap.classList.add("is-revealed");
    lootClaimButton.disabled = false;
    lootClaimButton.textContent = "Забрать предмет";
    addChestHistory(reward);
    chestResult.textContent = chestName + ": " + reward.name + " (" + reward.rarity + ")";
  }

  function playChestOpening(chestName, reward) {
    chestOpening = true;
    lootOverlay.classList.add("is-visible");
    lootOverlay.setAttribute("aria-hidden", "false");
    lootTitle.textContent = "Проверим, что внутри...";
    lootRarity.textContent = chestName.toUpperCase();
    lootRarity.className = "loot-rarity";
    lootDescription.textContent = "Сундук дрожит... Кажется, внутри что-то есть!";
    lootChestImage.src = chestImages[chestName] || "assets/chest-wood.png";
    lootChestImage.classList.remove("is-hidden");
    lootItemWrap.classList.remove("is-revealed");
    lootStage.classList.remove("has-reward", "is-opening");
    lootStage.classList.add("is-shaking");
    lootClaimButton.disabled = true;
    lootClaimButton.textContent = "Сундук открывается...";

    window.setTimeout(() => {
      if (!chestOpening) return;
      lootStage.classList.remove("is-shaking");
      lootStage.classList.add("is-opening");
      lootTitle.textContent = "Та-дам!";
      lootDescription.textContent = "Сейчас узнаем, какая вещь тебе досталась...";
    }, 1050);

    window.setTimeout(() => {
      if (!chestOpening) return;
      revealLoot(chestName, reward);
    }, 2050);
  }

  $$("[data-chest-cost]").forEach((button) => {
    button.addEventListener("click", () => {
      if (chestOpening) return;
      const cost = Number(button.dataset.chestCost);
      const name = button.dataset.chestName || "Сундук";
      if (!Number.isFinite(cost) || cost <= 0) return;

      if (coins < cost) {
        chestResult.textContent = "Недостаточно монет. Выполняй квесты, чтобы накопить на сундук.";
        showToast("Не хватает монет.");
        return;
      }

      coins -= cost;
      const reward = chestRewards[Math.floor(Math.random() * chestRewards.length)];
      coins += reward.coins;
      updateCoins();

      const inventory = readInventory();
      inventory.push({ name: reward.name, image: reward.image, rarity: reward.rarity, date: new Date().toISOString() });
      saveInventory(inventory);
      completeQuest("chest");
      playChestOpening(name, reward);
    });
  });

  lootClaimButton.addEventListener("click", () => {
    if (!pendingLoot) return;
    showToast("Предмет добавлен в коллекцию!");
    closeLootDialog();
  });
  lootClose.addEventListener("click", () => {
    if (!pendingLoot) {
      closeLootDialog();
      return;
    }
    closeLootDialog();
  });
  lootOverlay.addEventListener("click", (event) => {
    if (event.target === lootOverlay && pendingLoot) closeLootDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lootOverlay.classList.contains("is-visible") && pendingLoot) {
      closeLootDialog();
    }
  });

  // --------------------------------------------------
  // НАСТРОЙКИ И СБРОС
  // ------------------------------

  $("#reset-settings-btn").addEventListener("click", () => {
    if (!confirm("Сбросить оформление и настройки Vox?")) return;

    applyTheme("dark");

    body.dataset.style = "modern";
    styleSelect.value = "modern";
    saveSetting("style", "modern");

    frameSelect.value = "frame-none";
    applyFrame("frame-none");
    saveSetting("frame", "frame-none");

    updateAgeMode("teen");

    skinSelect.value = "body-fox";
    updateMascot();

    showToast("Настройки интерфейса сброшены.");
  });

  // ------------------------------
  // ТЕХПОДДЕРЖКА
  // ------------------------------

  $("#support-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const topic = $("#support-topic").value.trim();
    const description = $("#support-description").value.trim();

    if (!topic || !description) {
      showToast("Заполни тему и описание.");
      return;
    }

    showToast("Обращение подготовлено. Серверная отправка не настроена.");
    event.target.reset();
  });

  // ------------------------------
  // ВОССТАНОВЛЕНИЕ ПРОФИЛЯ
  // ------------------------------

  const savedName = readSetting("username", "");
  const savedHandle = readSetting("handle", "");

  if (savedName) {
    username = savedName;
    $("#display-name").textContent = savedName;
  }

  if (savedHandle) {
    userHandle = savedHandle;
    $("#display-username").textContent = savedHandle;
  }

  updateAgeMode(readSetting("age", "teen"));
  updateCoins();

  // Восстановить доступность полученных наград.
  ["message", "story", "mascot"].forEach((id) => {
    if (readSetting("quest-" + id, "available") === "claimed") {
      const button = document.querySelector(
        '[data-quest-id="' + id + '"]'
      );

      if (button) {
        button.disabled = true;
        button.textContent = "Получено ✓";
      }
    }
  });

  // Демо-версия: регистрация не требует настоящего сервера.
  // Для нового запуска регистрации экран остаётся стартовым.
});