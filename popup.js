const STORAGE_KEY = "blockedCompanies";
const form = document.querySelector("#add-company-form");
const input = document.querySelector("#company-name");
const list = document.querySelector("#company-list");
const emptyState = document.querySelector("#empty-state");
const message = document.querySelector("#message");

function normaliseCompanyName(name) {
  return name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function displayCompanyName(name) {
  return name.replace(/\s+/g, " ").trim();
}

async function getCompanies() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
}

function setMessage(text) {
  message.textContent = text;
}

function render(companies) {
  list.replaceChildren();
  emptyState.hidden = companies.length > 0;

  companies.forEach((company) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const remove = document.createElement("button");
    name.textContent = company;
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      const current = await getCompanies();
      const next = current.filter(
        (item) => normaliseCompanyName(item) !== normaliseCompanyName(company)
      );
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      setMessage(`${company} removed.`);
      render(next);
    });
    item.append(name, remove);
    list.append(item);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const company = displayCompanyName(input.value);
  if (!company) return;

  const companies = await getCompanies();
  if (companies.some((item) => normaliseCompanyName(item) === normaliseCompanyName(company))) {
    setMessage("That company is already blocked.");
    return;
  }

  const next = [...companies, company].sort((a, b) => a.localeCompare(b));
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  input.value = "";
  setMessage(`${company} blocked.`);
  render(next);
});

getCompanies().then(render);
