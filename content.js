(() => {
  "use strict";

  const STORAGE_KEY = "blockedCompanies";
  const HIDDEN_CLASS = "icb-hidden-listing";
  const CARD_CLASS = "icb-listing-card";
  const BUTTON_CLASS = "icb-block-button";
  const FLOAT_BUTTON_CLASS = "icb-float-button";
  const PANEL_CLASS = "icb-panel";
  const STYLE_ID = "icb-extension-style";
  const EASY_APPLY_MODAL_SELECTOR = ".modal-content.easy-apply";
  const EASY_APPLY_SKIP_SELECTOR = "#easy_apply_skip.skip_button, .easy_apply_skip.skip_button";
  const INSTANCE_ID = crypto.randomUUID();
  const cardSelectors = [
    "#internship_list_container .individual_internship",
    ".individual_internship",
    ".individual_job",
    '[id^="individual_internship_"]',
    '[id^="individual_job_"]'
  ];
  const companySelectors = [
    ".company_name a",
    ".company_name",
    '[data-testid*="company"]',
    '[data-test*="company"]',
    '[class*="company"] a',
    'a[href*="/company/"]'
  ];

  let blockedCompanies = [];
  let queued = false;
  let easyApplySkipQueued = false;
  const skippedEasyApplyRecommendations = new Set();

  function removePreviousExtensionUi() {
    document.getElementById(STYLE_ID)?.remove();
    document
      .querySelectorAll(`.${BUTTON_CLASS}, .${FLOAT_BUTTON_CLASS}, .${PANEL_CLASS}`)
      .forEach((element) => element.remove());
  }

  function normaliseCompanyName(name) {
    return name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  }

  function isBlocked(companyName) {
    const key = normaliseCompanyName(companyName);
    return blockedCompanies.some((company) => normaliseCompanyName(company) === key);
  }

  async function saveBlockedCompanies(companies) {
    blockedCompanies = companies;
    await chrome.storage.local.set({ [STORAGE_KEY]: companies });
    renderBlockedCompaniesPanel();
  }

  function getCompanyElement(card) {
    for (const selector of companySelectors) {
      const element = card.querySelector(selector);
      if (element?.textContent?.trim()) return element;
    }
    return null;
  }

  function getCompanyName(companyElement) {
    const companyLink = companyElement.matches("a")
      ? companyElement
      : companyElement.querySelector("a");
    if (companyLink?.textContent?.trim()) return companyLink.textContent.trim();

    const copy = companyElement.cloneNode(true);
    copy.querySelectorAll(
      '[class*="hiring" i], [class*="badge" i], [class*="status" i], small, svg, img'
    ).forEach((element) => element.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  }

  function getListingCards() {
    if (/^\/(?:job|internship)(?:\/|$)/.test(location.pathname)) return [];

    const cards = new Set();
    for (const selector of cardSelectors) {
      document.querySelectorAll(selector).forEach((card) => {
        if (card.querySelector("a")) cards.add(card);
      });
    }
    return [...cards];
  }

  function skipBlockedEasyApplyRecommendation() {
    const modal = document.querySelector(EASY_APPLY_MODAL_SELECTOR);
    if (!modal) {
      easyApplySkipQueued = false;
      skippedEasyApplyRecommendations.clear();
      return;
    }

    const card = modal.querySelector(cardSelectors.join(", "));
    const companyElement = card && getCompanyElement(card);
    const companyName = companyElement && getCompanyName(companyElement);
    if (!card || !companyName || !isBlocked(companyName)) return;

    const recommendationId = card.getAttribute("internshipid") || card.id;
    if (!recommendationId || easyApplySkipQueued || skippedEasyApplyRecommendations.has(recommendationId)) return;

    const skipButton = modal.querySelector(EASY_APPLY_SKIP_SELECTOR);
    if (!skipButton || skipButton.disabled) return;

    easyApplySkipQueued = true;
    requestAnimationFrame(() => {
      easyApplySkipQueued = false;

      const currentModal = document.querySelector(EASY_APPLY_MODAL_SELECTOR);
      const currentCard = currentModal?.querySelector(cardSelectors.join(", "));
      const currentCompanyElement = currentCard && getCompanyElement(currentCard);
      const currentCompanyName = currentCompanyElement && getCompanyName(currentCompanyElement);
      const currentRecommendationId = currentCard?.getAttribute("internshipid") || currentCard?.id;
      const currentSkipButton = currentModal?.querySelector(EASY_APPLY_SKIP_SELECTOR);

      if (
        currentRecommendationId !== recommendationId ||
        !currentCompanyName ||
        !isBlocked(currentCompanyName) ||
        !currentSkipButton ||
        currentSkipButton.disabled ||
        skippedEasyApplyRecommendations.has(recommendationId)
      ) return;

      skippedEasyApplyRecommendations.add(recommendationId);
      currentSkipButton.click();
    });
  }

  function addBlockButton(card, companyElement, companyName) {
    const existingButton = card.querySelector(`.${BUTTON_CLASS}`);
    if (existingButton?.dataset.icbInstance === INSTANCE_ID) return;
    existingButton?.remove();

    card.classList.add(CARD_CLASS);
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.dataset.icbInstance = INSTANCE_ID;
    button.textContent = "Block company";
    button.title = `Hide all listings from ${companyName}`;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isBlocked(companyName)) {
        await saveBlockedCompanies([...blockedCompanies, companyName].sort((a, b) => a.localeCompare(b)));
      }
      applyBlocklist();
    });
    card.append(button);
  }

  function applyBlocklist() {
    getListingCards().forEach((card) => {
      const companyElement = getCompanyElement(card);
      const companyName = companyElement && getCompanyName(companyElement);
      if (!companyName) return;

      const companyIsBlocked = isBlocked(companyName);
      card.classList.toggle(HIDDEN_CLASS, companyIsBlocked);
      if (!companyIsBlocked) addBlockButton(card, companyElement, companyName);
    });
    skipBlockedEasyApplyRecommendation();
  }

  function renderBlockedCompaniesPanel() {
    const panel = document.querySelector(`.${PANEL_CLASS}`);
    const floatButton = document.querySelector(`.${FLOAT_BUTTON_CLASS}`);
    if (!panel || !floatButton) return;

    floatButton.textContent = `Blocked companies (${blockedCompanies.length})`;
    const list = panel.querySelector("ul");
    const emptyState = panel.querySelector("p");
    list.replaceChildren();
    emptyState.hidden = blockedCompanies.length > 0;

    blockedCompanies.forEach((company) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const remove = document.createElement("button");
      name.textContent = company;
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        const key = normaliseCompanyName(company);
        await saveBlockedCompanies(blockedCompanies.filter((item) => normaliseCompanyName(item) !== key));
        applyBlocklist();
      });
      item.append(name, remove);
      list.append(item);
    });
  }

  function addFloatingPanel() {
    if (document.querySelector(`.${FLOAT_BUTTON_CLASS}`)) return;

    const floatButton = document.createElement("button");
    const panel = document.createElement("section");
    const heading = document.createElement("h2");
    const closeButton = document.createElement("button");
    const list = document.createElement("ul");
    const emptyState = document.createElement("p");

    floatButton.type = "button";
    floatButton.className = FLOAT_BUTTON_CLASS;
    floatButton.setAttribute("aria-expanded", "false");
    floatButton.setAttribute("aria-controls", "icb-panel");
    panel.className = PANEL_CLASS;
    panel.id = "icb-panel";
    panel.hidden = true;
    heading.textContent = "Blocked companies";
    closeButton.type = "button";
    closeButton.className = "icb-close-button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close blocked companies");
    emptyState.textContent = "No companies blocked yet.";

    floatButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      floatButton.setAttribute("aria-expanded", String(!panel.hidden));
    });
    closeButton.addEventListener("click", () => floatButton.click());

    panel.append(heading, closeButton, emptyState, list);
    document.body.append(floatButton, panel);
    renderBlockedCompaniesPanel();
  }

  function queueApplyBlocklist() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyBlocklist();
    });
  }

  async function start() {
    removePreviousExtensionUi();

    const stored = await chrome.storage.local.get(STORAGE_KEY);
    blockedCompanies = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_CLASS} { display: none !important; }
      .${CARD_CLASS} { position: relative !important; }
      .${BUTTON_CLASS} {
        position: absolute; right: 14px; bottom: 14px; z-index: 2;
        margin: 0; padding: 5px 8px; border: 1px solid #d1d5db;
        border-radius: 4px; background: #fff; color: #4b5563; cursor: pointer;
        font: 12px/1.2 Arial, sans-serif;
      }
      .${BUTTON_CLASS}:hover { border-color: #ef4444; color: #b91c1c; }
      .${FLOAT_BUTTON_CLASS} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
        padding: 11px 14px; border: 0; border-radius: 999px; background: #0d6efd;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .2); color: white; cursor: pointer;
        font: 600 14px/1 Arial, sans-serif;
      }
      .${PANEL_CLASS} {
        position: fixed; right: 20px; bottom: 70px; z-index: 2147483646;
        box-sizing: border-box; width: min(360px, calc(100vw - 40px)); max-height: 360px;
        overflow: auto; padding: 16px; border: 1px solid #d1d5db; border-radius: 10px;
        background: #fff; box-shadow: 0 10px 30px rgba(0, 0, 0, .22); color: #1f2937;
        font: 14px/1.4 Arial, sans-serif;
      }
      .${PANEL_CLASS} h2 { margin: 0 28px 12px 0; font-size: 16px; }
      .${PANEL_CLASS} p { margin: 0; color: #6b7280; }
      .${PANEL_CLASS} ul { margin: 0; padding: 0; list-style: none; }
      .${PANEL_CLASS} li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; border-top: 1px solid #e5e7eb; }
      .${PANEL_CLASS} li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .${PANEL_CLASS} li button, .icb-close-button { border: 0; border-radius: 4px; background: #e5e7eb; color: #374151; cursor: pointer; font: 12px Arial, sans-serif; }
      .${PANEL_CLASS} li button { padding: 5px 7px; }
      .icb-close-button { position: absolute; top: 10px; right: 10px; padding: 2px 7px; font-size: 20px; line-height: 1; }
    `;
    document.documentElement.append(style);

    addFloatingPanel();
    applyBlocklist();
    new MutationObserver(queueApplyBlocklist).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;
    blockedCompanies = Array.isArray(changes[STORAGE_KEY].newValue)
      ? changes[STORAGE_KEY].newValue
      : [];
    renderBlockedCompaniesPanel();
    applyBlocklist();
  });

  start().catch((error) => console.warn("Internshala Company Blocker:", error));
})();
