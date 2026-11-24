(() => {
const api = window.watch;
let pythonBusy = false;
let setupCalloutDismissed = false;
let userPickedTab = false;
let didInitialTab = false;
/** @type {Set<string>} */
const querySelection = new Set();
/** @type {Set<string>} */
let knownQueryIds = new Set();
let queryBankBootstrapped = false;
let latestState = null;
/** @type {{ id: string, companyIds: string[], weekday: number, hour: number, enabled: boolean }[]} */
let customDrafts = [];
let draftSeq = 0;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function resetQuerySelectionState() {
  querySelection.clear();
  knownQueryIds.clear();
  queryBankBootstrapped = false;
}

function syncQuerySelection(queries) {
  const ids = (queries || []).map((query) => query.query_item_id);
  if (ids.length === 0) {
    resetQuerySelectionState();
    return;
  }
  const idSet = new Set(ids);
  for (const id of [...querySelection]) {
    if (!idSet.has(id)) querySelection.delete(id);
  }
  if (!queryBankBootstrapped) {
    for (const id of ids) querySelection.add(id);
    queryBankBootstrapped = true;
    knownQueryIds = idSet;
    return;
  }
  const bankChanged =
    ids.length !== knownQueryIds.size ||
    ids.some((id) => !knownQueryIds.has(id)) ||
    [...knownQueryIds].some((id) => !idSet.has(id));
  if (!bankChanged) return;
  const sameCampaignBank = ids.some((id) => knownQueryIds.has(id));
  if (!sameCampaignBank) {
    querySelection.clear();
    for (const id of ids) querySelection.add(id);
  } else {
    for (const id of ids) {
      if (!knownQueryIds.has(id)) querySelection.add(id);
    }
  }
  knownQueryIds = idSet;
}

function selectedQueryItemIds() {
  return [...querySelection];
}

function showTab(tabId) {
  document.querySelectorAll(".tabs button").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function text(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function openCamoufoxHelp() {
  const dialog = document.getElementById("camoufoxHelpDialog");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const windows = /Windows/i.test(navigator.userAgent);
  const macNote = document.getElementById("pythonMacNote");
  const windowsNote = document.getElementById("pythonWindowsNote");
  const downloadLink = document.getElementById("pythonDownloadLink");
  if (macNote) macNote.hidden = windows;
  if (windowsNote) windowsNote.hidden = !windows;
  if (downloadLink) {
    downloadLink.href = windows
      ? "https://www.python.org/downloads/windows/"
      : "https://www.python.org/downloads/macos/";
  }
  if (!dialog.open) dialog.showModal();
}

function setPythonProgressDetail(detail) {
  const el = document.getElementById("pythonProgressDetail");
  if (!el) return;
  el.textContent = detail || "";
  el.hidden = !detail;
}

function showPythonProgress(progress) {
  if (!progress) return;
  const label = progress.label || "Setting up Camoufox";
  const headline = progress.step
    ? `Step ${progress.step} of ${progress.total}: ${label}.`
    : `${label}.`;
  text("pythonHelp", headline);
  setPythonProgressDetail(progress.detail || "");
  const status = document.getElementById("python-status");
  if (status && pythonBusy) status.textContent = headline;
  const setup = document.getElementById("setupPython");
  if (setup && setup.classList.contains("busy")) setup.textContent = label;
}

function renderSetupPythonCallout(pythonReady, busy) {
  const callout = document.getElementById("setupPythonCallout");
  const setupPython = document.getElementById("setupPython");
  const retryPython = document.getElementById("retryPython");
  const providersTab = document.querySelector('.tabs button[data-tab="providers"]');
  if (pythonReady) {
    setupCalloutDismissed = false;
  }
  const showSetup = !pythonReady && !busy;
  if (callout) {
    callout.hidden = !showSetup;
    callout.classList.toggle("is-dismissed", setupCalloutDismissed);
  }
  if (retryPython) retryPython.hidden = !pythonReady || busy;
  if (setupPython && showSetup) {
    setupPython.hidden = false;
    setupPython.classList.toggle("setup-python-cta", !setupCalloutDismissed);
  }
  if (providersTab) {
    providersTab.classList.toggle("needs-setup-attention", showSetup);
  }
}

function renderPythonStatus(state) {
  const el = document.getElementById("python-status");
  if (!el) return;
  const message = (state.python && state.python.message) || "";
  const ready = Boolean(state.python && state.python.ok);
  el.replaceChildren();
  if (!message) return;
  if (ready) {
    el.textContent = message;
    return;
  }
  const link = document.createElement("button");
  link.type = "button";
  link.className = "status-link";
  link.textContent = message;
  link.title = "How to set up Camoufox";
  link.addEventListener("click", openCamoufoxHelp);
  el.appendChild(link);
}

function setError(message) {
  text("error", message);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let accountLabelDialogResolver = null;

function openAccountLabelDialog(providerName, initialValue = "") {
  const dialog = document.getElementById("providerAccountLabelDialog");
  const input = document.getElementById("providerAccountLabelInput");
  const title = document.getElementById("providerAccountLabelTitle");
  if (!dialog || !input || !title || !dialog.showModal) {
    return Promise.resolve(null);
  }
  title.textContent = `Label ${providerName} login`;
  input.value = initialValue || "";
  return new Promise((resolve) => {
    accountLabelDialogResolver = resolve;
    dialog.showModal();
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}

function closeAccountLabelDialog(value) {
  const dialog = document.getElementById("providerAccountLabelDialog");
  if (accountLabelDialogResolver) {
    accountLabelDialogResolver(value);
    accountLabelDialogResolver = null;
  }
  if (dialog && !dialog.open) return;
  dialog?.close();
}

function setBusy(button, busy, idleLabel, busyLabel) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle("busy", busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");
  button.textContent = busy ? busyLabel : idleLabel;
}

window.setWatchBusy = setBusy;

const AUTH_DISPLAY = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  google: "Google",
  perplexity: "Perplexity",
};

const RUN_DISPLAY = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  "ai-overview": "Google AI Overview",
  perplexity: "Perplexity",
};

const PRIMARY_GROUP_TITLE = "AI Search Platforms";
const PRIMARY_AUTH = ["chatgpt", "claude", "gemini", "google"];
const EXPERIMENTAL_AUTH = ["perplexity"];
const PRIMARY_RUN = ["chatgpt", "claude", "gemini", "ai-overview"];
const EXPERIMENTAL_RUN = ["perplexity"];

function displayName(map, id) {
  return map[id] || id;
}

function formatRunProgressItem(item) {
  const display = window.WatchRunItemDisplay?.formatRunItemStatus;
  if (typeof display === "function") {
    return display(item);
  }
  return {
    status: item.status,
    errorSuffix: item.error ? ` · ${item.error}` : "",
    title: null,
  };
}

function appendRunProgressLine(list, item, prefix) {
  const formatted = formatRunProgressItem(item);
  const li = document.createElement("li");
  li.textContent = `${prefix}${displayName(RUN_DISPLAY, item.provider)} · ${item.question} · ${formatted.status}${formatted.errorSuffix}`;
  if (formatted.title) {
    li.title = formatted.title;
    li.classList.add("run-progress--no-overview");
  }
  list.appendChild(li);
}

function splitProviders(list, primaryIds, experimentalIds) {
  const byId = new Map(list.map((item) => [item.id, item]));
  return {
    primary: primaryIds.map((id) => byId.get(id)).filter(Boolean),
    experimental: experimentalIds.map((id) => byId.get(id)).filter(Boolean),
  };
}

function addGroup(parent, title, hint, experimental) {
  const group = document.createElement("fieldset");
  group.className = experimental
    ? "provider-group provider-group--experimental"
    : "provider-group";
  const legend = document.createElement("legend");
  legend.textContent = title;
  group.append(legend);
  if (hint) {
    const note = document.createElement("p");
    note.className = "status";
    note.textContent = hint;
    group.append(note);
  }
  const body = document.createElement("div");
  body.className = "provider-group-body";
  group.append(body);
  parent.append(group);
  return body;
}

function formatLastSync(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const diffMs = Date.now() - then.getTime();
  if (diffMs < 45_000) return "Just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  return then.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function captureWord(count) {
  return count === 1 ? "capture" : "captures";
}

function renderSync(state) {
  const unpaired = document.getElementById("syncUnpaired");
  const card = document.getElementById("syncCard");
  const headline = document.getElementById("syncHeadline");
  const detail = document.getElementById("syncDetail");
  const syncNow = document.getElementById("syncNow");
  if (!state.paired) {
    if (unpaired) unpaired.hidden = false;
    if (card) card.hidden = true;
    if (syncNow) syncNow.disabled = true;
    return;
  }
  if (unpaired) unpaired.hidden = true;
  if (card) card.hidden = false;
  if (syncNow) syncNow.disabled = state.running;
  if (!headline || !detail || !card) return;

  card.className = "sync-card";
  const pending = state.pendingSync || 0;
  const uploaded = state.lastSyncUploaded;
  const failed = state.lastSyncFailed;
  const when = formatLastSync(state.lastSyncAt);

  if (pending > 0) {
    card.classList.add("sync-card--pending");
    headline.textContent = `${pending} ${captureWord(pending)} waiting on this computer`;
    detail.textContent =
      "Sync sends answer text to Oppvera for scoring. You can sync now or after a run finishes.";
    return;
  }

  if (failed != null && failed > 0) {
    card.classList.add("sync-card--warn");
    headline.textContent = "Sync finished with errors";
    const parts = [];
    if (uploaded != null && uploaded > 0) {
      parts.push(`${uploaded} ${captureWord(uploaded)} uploaded`);
    }
    parts.push(`${failed} failed`);
    if (when) parts.push(`Checked ${when}`);
    detail.textContent = parts.join(" · ");
    return;
  }

  if (state.scheduleNote && detail && !detail.dataset.schedule) {
    const note = document.createElement("p");
    detail.dataset.schedule = "1";
    note.textContent = state.scheduleNote;
    card.appendChild(note);
  }

  if (state.lastSyncAt) {
    card.classList.add("sync-card--success");
    headline.textContent = "All captures synced to Oppvera";
    const parts = [];
    if (uploaded != null && uploaded > 0) {
      parts.push(
        `Sent ${uploaded} ${captureWord(uploaded)} on the last sync`,
      );
    } else if (uploaded === 0) {
      parts.push("Nothing was waiting; Oppvera already has your latest data");
    }
    if (when) parts.push(`Last sync ${when}`);
    detail.textContent = parts.join(" · ");
    return;
  }

  headline.textContent = "Nothing waiting to sync";
  detail.textContent =
    "Run the query bank to capture answers, then sync or let a run upload automatically.";
}

function companyKey(campaign) {
  const id = campaign && campaign.company_id && String(campaign.company_id).trim();
  if (id) return id;
  const name = campaign && campaign.company_name && String(campaign.company_name).trim();
  return name ? `name:${name}` : "none";
}

function companyDisplayName(campaign) {
  const name = campaign && campaign.company_name && String(campaign.company_name).trim();
  return name || "No company";
}

function groupCampaignsByCompany(campaigns) {
  const groups = new Map();
  for (const campaign of campaigns || []) {
    const key = companyKey(campaign);
    if (!groups.has(key)) {
      groups.set(key, { key, name: companyDisplayName(campaign), campaigns: [] });
    }
    groups.get(key).campaigns.push(campaign);
  }
  for (const group of groups.values()) {
    group.campaigns.sort((a, b) =>
      String(a.campaign_name || "").localeCompare(String(b.campaign_name || "")),
    );
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function scheduleEditorFocused() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return false;
  return Boolean(active.closest("#companyScheduleList, #customScheduleList"));
}

function weekdaySelect(selected) {
  const select = document.createElement("select");
  select.dataset.field = "weekday";
  WEEKDAYS.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = name;
    option.selected = index === Number(selected);
    select.appendChild(option);
  });
  return select;
}

function hourField(value) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "23";
  input.dataset.field = "hour";
  input.value = String(value ?? 9);
  return input;
}

function enableField(checked) {
  const label = document.createElement("label");
  label.className = "checkbox-row";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset.field = "enabled";
  box.checked = Boolean(checked);
  label.append(box, document.createTextNode(" Enable"));
  return label;
}

function fieldsFrom(root) {
  const enabled = root.querySelector("[data-field=enabled]");
  const weekday = root.querySelector("[data-field=weekday]");
  const hour = root.querySelector("[data-field=hour]");
  return {
    enabled: Boolean(enabled && enabled.checked),
    weekday: Number(weekday ? weekday.value : 1),
    hour: Number(hour ? hour.value : 9),
  };
}

function campaignIdsForKeys(keys) {
  const wanted = new Set(keys);
  return ((latestState && latestState.campaigns) || [])
    .filter((campaign) => wanted.has(companyKey(campaign)))
    .map((campaign) => campaign.campaign_id);
}

async function saveSchedule(payload, button, draftId) {
  if (!api || typeof api.saveRunSchedule !== "function") return;
  setBusy(button, true, "Save", "Saving…");
  try {
    const state = await api.saveRunSchedule(payload);
    if (draftId) customDrafts = customDrafts.filter((row) => row.id !== draftId);
    render(state);
  } catch (error) {
    setError(error.message || String(error));
  } finally {
    setBusy(button, false, "Save", "Saving…");
  }
}

async function runCompanyKeys(keys, button) {
  if (!keys.length) {
    setError("Choose at least one company.");
    return;
  }
  const ids = campaignIdsForKeys(keys);
  if (!ids.length) {
    setError("Pair a campaign for that company first.");
    return;
  }
  if (!api || typeof api.startGroupRun !== "function") return;
  setError("");
  setBusy(button, true, "Run now", "Running…");
  try {
    render(await api.startGroupRun({ campaignIds: ids, providers: [] }));
  } catch (error) {
    setError(error.message || String(error));
  } finally {
    setBusy(button, false, "Run now", "Running…");
  }
}

function pairButtonLabel(state) {
  return state && (state.campaigns || []).length ? "Add campaign" : "Pair campaign";
}

function appendCampaignRow(parent, campaign, state, radioName) {
  const row = document.createElement("div");
  row.className = "campaign-row";
  const label = document.createElement("label");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = radioName;
  radio.value = campaign.campaign_id;
  radio.checked = state.device && state.device.campaign_id === campaign.campaign_id;
  radio.disabled = state.running;
  radio.onchange = async () => {
    if (!api || typeof api.setActiveCampaign !== "function") return;
    try {
      render(await api.setActiveCampaign(campaign.campaign_id));
    } catch (error) {
      setError(error.message || String(error));
    }
  };
  label.append(radio, document.createTextNode(` ${campaign.campaign_name}`));
  const remove = document.createElement("button");
  remove.className = "ghost";
  remove.type = "button";
  remove.textContent = "Remove";
  remove.disabled = state.running;
  remove.onclick = async () => {
    if (!api) return;
    render(await api.unpair({ campaignId: campaign.campaign_id }));
  };
  row.append(label, remove);
  parent.appendChild(row);
}

function renderStoredCampaigns(state) {
  const list = document.getElementById("campaignList");
  if (!list) return;
  list.innerHTML = "";
  const campaigns = state.campaigns || [];
  if (!campaigns.length) {
    list.hidden = true;
    return;
  }
  list.hidden = false;
  for (const group of groupCampaignsByCompany(campaigns)) {
    const block = document.createElement("section");
    block.className = "company-block";
    const title = document.createElement("h3");
    title.textContent = group.name;
    block.appendChild(title);
    for (const campaign of group.campaigns) {
      appendCampaignRow(block, campaign, state, "activeCampaignSettings");
    }
    list.appendChild(block);
  }
}

function appendScheduleFields(parent, saved, running) {
  const fields = document.createElement("div");
  fields.className = "schedule-fields";
  fields.appendChild(enableField(saved ? saved.enabled : false));
  const dayLabel = document.createElement("label");
  dayLabel.append(
    document.createTextNode("Day"),
    weekdaySelect(saved ? saved.weekday : 1),
  );
  const hourLabel = document.createElement("label");
  hourLabel.append(
    document.createTextNode("Hour (local, 24h)"),
    hourField(saved ? saved.hour : 9),
  );
  fields.append(dayLabel, hourLabel);
  parent.appendChild(fields);
  const actions = document.createElement("div");
  actions.className = "schedule-actions";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "ghost";
  save.textContent = "Save";
  save.disabled = running;
  const run = document.createElement("button");
  run.type = "button";
  run.className = "primary";
  run.textContent = "Run now";
  run.disabled = running;
  actions.append(save, run);
  parent.appendChild(actions);
  return { fields, actions, save, run };
}

function renderCompanySchedules(state) {
  const list = document.getElementById("companyScheduleList");
  if (!list || scheduleEditorFocused()) return;
  list.innerHTML = "";
  const groups = groupCampaignsByCompany(state.campaigns);
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Pair a campaign to schedule it by company.";
    list.appendChild(empty);
    return;
  }
  for (const group of groups) {
    const saved = (state.schedules || []).find(
      (row) => row.kind === "company" && row.companyIds && row.companyIds[0] === group.key,
    );
    const block = document.createElement("section");
    block.className = "company-block";
    const title = document.createElement("h3");
    title.textContent = group.name;
    block.appendChild(title);
    for (const campaign of group.campaigns) {
      appendCampaignRow(block, campaign, state, "activeCampaignAdvanced");
    }
    const controls = appendScheduleFields(block, saved, state.running);
    controls.save.onclick = () => {
      void saveSchedule(
        {
          id: `company:${group.key}`,
          kind: "company",
          companyIds: [group.key],
          ...fieldsFrom(controls.fields),
        },
        controls.save,
      );
    };
    controls.run.onclick = () => void runCompanyKeys([group.key], controls.run);
    list.appendChild(block);
  }
  if ((state.campaigns || []).length > 1) {
    const all = document.createElement("button");
    all.className = "ghost";
    all.type = "button";
    all.textContent = "Remove all campaigns";
    all.disabled = state.running;
    all.onclick = async () => {
      if (!api) return;
      render(await api.unpair({ all: true }));
    };
    list.appendChild(all);
  }
}

function renderCustomSchedules(state) {
  const list = document.getElementById("customScheduleList");
  if (!list || scheduleEditorFocused()) return;
  list.innerHTML = "";
  const groups = groupCampaignsByCompany(state.campaigns);
  const rows = [
    ...(state.schedules || [])
      .filter((row) => row.kind === "custom")
      .map((row) => ({ draft: false, row })),
    ...customDrafts.map((row) => ({ draft: true, row })),
  ];
  for (const entry of rows) {
    const block = document.createElement("section");
    block.className = "company-block";
    const boxes = document.createElement("div");
    boxes.className = "company-checks";
    for (const group of groups) {
      const label = document.createElement("label");
      label.className = "checkbox-row";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = group.key;
      box.checked = (entry.row.companyIds || []).includes(group.key);
      box.disabled = state.running;
      label.append(box, document.createTextNode(` ${group.name}`));
      boxes.appendChild(label);
    }
    block.appendChild(boxes);
    const controls = appendScheduleFields(block, entry.row, state.running);
    controls.save.onclick = () => {
      const companyIds = [...boxes.querySelectorAll("input:checked")].map(
        (input) => input.value,
      );
      void saveSchedule(
        {
          id: entry.draft ? entry.row.id : entry.row.id,
          kind: "custom",
          companyIds,
          ...fieldsFrom(controls.fields),
        },
        controls.save,
        entry.draft ? entry.row.id : undefined,
      );
    };
    controls.run.onclick = () => {
      const companyIds = [...boxes.querySelectorAll("input:checked")].map(
        (input) => input.value,
      );
      void runCompanyKeys(companyIds, controls.run);
    };
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "Remove";
    remove.disabled = state.running;
    remove.onclick = async () => {
      if (entry.draft) {
        customDrafts = customDrafts.filter((row) => row.id !== entry.row.id);
        if (latestState) render(latestState);
        return;
      }
      if (!api || typeof api.removeRunSchedule !== "function") return;
      render(await api.removeRunSchedule(entry.row.id));
    };
    controls.actions.appendChild(remove);
    list.appendChild(block);
  }
}

function renderScheduleSummary(state) {
  const box = document.getElementById("scheduleSummary");
  if (!box) return;
  box.innerHTML = "";
  const lines = state.scheduleSummaries || [];
  if (!lines.length) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "No scheduled run yet.";
    box.appendChild(note);
    return;
  }
  for (const line of lines) {
    const note = document.createElement("p");
    note.className = "status";
    note.textContent = line;
    box.appendChild(note);
  }
}

function renderWeeklySchedule(state) {
  if (state.schedulePrivacyNote) text("advancedPrivacy", state.schedulePrivacyNote);
  renderScheduleSummary(state);
  renderCompanySchedules(state);
  renderCustomSchedules(state);
}

function render(state) {
  if (!state) return;
  latestState = state;
  renderWeeklySchedule(state);
  text(
    "appVersion",
    state.appVersionLabel ||
      (state.appVersion ? `Oppvera Watch v${state.appVersion}` : "Oppvera Watch"),
  );
  renderPythonStatus(state);
  if (!pythonBusy) {
    text("pythonHelp", state.python && state.python.message);
    setPythonProgressDetail("");
  }
  const pythonReady = Boolean(state.python && state.python.ok);
  renderSetupPythonCallout(pythonReady, pythonBusy);
  text("pairError", state.lastError || "");
  setError(state.lastError || "");
  const pairBtn = document.getElementById("pairBtn");
  const pairStatus = document.getElementById("pairStatus");
  renderStoredCampaigns(state);
  if (state.paired && state.device) {
    const summary = `${state.device.company_name} / ${state.device.campaign_name}`;
    text("campaignHint", summary);
    if (pairStatus) pairStatus.textContent = state.device.api_base;
    const apiBase = document.getElementById("apiBase");
    if (apiBase && state.device.api_base) apiBase.value = state.device.api_base;
    if (pairBtn && document.activeElement !== pairBtn) {
      pairBtn.textContent = pairButtonLabel(state);
    }
  } else {
    text("campaignHint", "Pair this computer to a campaign to start.");
    if (pairStatus) pairStatus.textContent = "Not paired.";
    if (pairBtn && document.activeElement !== pairBtn) {
      pairBtn.textContent = pairButtonLabel(state);
    }
  }
  if (!didInitialTab && !userPickedTab) {
    didInitialTab = true;
    showTab(state.paired ? "bank" : "pair");
  }
  const queryList = document.getElementById("queryList");
  if (queryList) {
    syncQuerySelection(state.queries);
    queryList.innerHTML = "";
    if (!state.queries || !state.queries.length) {
      queryList.innerHTML =
        "<li>No questions yet. Add a query bank in Oppvera, then refresh.</li>";
    } else {
      for (const query of state.queries) {
        const item = document.createElement("li");
        const label = document.createElement("label");
        label.className = "checkbox-row";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = query.query_item_id;
        box.checked = querySelection.has(query.query_item_id);
        box.disabled = state.running;
        box.onchange = () => {
          if (box.checked) querySelection.add(query.query_item_id);
          else querySelection.delete(query.query_item_id);
        };
        label.append(box, document.createTextNode(` ${query.text}`));
        item.appendChild(label);
        queryList.appendChild(item);
      }
    }
  }
  const providerList = document.getElementById("providerList");
  if (providerList) {
    providerList.innerHTML = "";
    const groups = splitProviders(
      state.providers || [],
      PRIMARY_AUTH,
      EXPERIMENTAL_AUTH,
    );
    const renderAuthRow = (provider, target) => {
      const row = document.createElement("div");
      row.className = "row";
      const label = AUTH_DISPLAY[provider.id] || provider.id;
      if (provider.connecting) {
        row.innerHTML = `<span>${label} · <strong>Connecting</strong> — finish sign-in in the Camoufox window, then <strong>close that window</strong> to complete.</span>`;
        target.appendChild(row);
        return;
      }
      const account =
        provider.connected && provider.accountLabel
          ? ` · ${escapeHtml(provider.accountLabel)}`
          : provider.connected
            ? " · connected"
            : "";
      row.innerHTML = `<span>${label}${account}${
        provider.error ? ` · ${provider.error}` : ""
      }</span>`;
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const action = document.createElement("button");
      action.className = "ghost";
      action.type = "button";
      if (provider.connected) {
        const labelIdle = provider.accountLabel ? "Edit label" : "Label account";
        const labelBtn = document.createElement("button");
        labelBtn.className = "ghost";
        labelBtn.type = "button";
        labelBtn.textContent = labelIdle;
        labelBtn.onclick = async () => {
          const named = await openAccountLabelDialog(
            AUTH_DISPLAY[provider.id] || provider.id,
            provider.accountLabel || "",
          );
          if (!named?.trim()) return;
          setError("");
          setBusy(labelBtn, true, labelIdle, "Saving…");
          try {
            const nextState = await api.setProviderAccountLabel(
              provider.id,
              named.trim(),
            );
            render(nextState);
          } catch (error) {
            setError(error.message || String(error));
          } finally {
            setBusy(labelBtn, false, labelIdle, "Saving…");
          }
        };
        actions.append(labelBtn);
        action.textContent = "Disconnect";
        action.onclick = async () => {
          setError("");
          setBusy(action, true, "Disconnect", "Disconnecting…");
          try {
            await api.resetProvider(provider.id);
          } catch (error) {
            setError(error.message || String(error));
          } finally {
            setBusy(action, false, "Disconnect", "Disconnecting…");
          }
        };
      } else {
        action.textContent = "Connect";
        action.onclick = async () => {
          setError("");
          setBusy(
            action,
            true,
            "Connect",
            "Finish in Camoufox, then close the window…",
          );
          try {
            await api.connectProvider(provider.id);
          } catch (error) {
            setError(error.message || String(error));
          } finally {
            setBusy(
              action,
              false,
              "Connect",
              "Finish in Camoufox, then close the window…",
            );
          }
        };
      }
      actions.append(action);
      row.appendChild(actions);
      target.appendChild(row);
    };
    const primaryBox = addGroup(providerList, PRIMARY_GROUP_TITLE, "", false);
    for (const provider of groups.primary) renderAuthRow(provider, primaryBox);
    const experimentalBox = addGroup(providerList, "Experimental", "", true);
    for (const provider of groups.experimental) {
      renderAuthRow(provider, experimentalBox);
    }
  }
  function fillRunProviderList(container) {
    if (!container) return;
    const previous = new Set(
      [...container.querySelectorAll("input:checked")].map((input) => input.value),
    );
    const hadBoxes = Boolean(container.querySelector("input"));
    container.innerHTML = "";
    const groups = splitProviders(
      state.runtimeProviders || [],
      PRIMARY_RUN,
      EXPERIMENTAL_RUN,
    );
    const renderRunRow = (provider, target, experimental) => {
      const needsLogin = !provider.connected;
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = provider.id;
      box.disabled = state.running || needsLogin;
      if (hadBoxes) {
        box.checked = previous.has(provider.id) && !needsLogin;
      } else {
        box.checked = !experimental && provider.connected;
      }
      const suffix = provider.connected
        ? " · connected"
        : " (connect first)";
      label.append(
        box,
        document.createTextNode(
          ` ${displayName(RUN_DISPLAY, provider.id)}${suffix}`,
        ),
      );
      target.appendChild(label);
    };
    const primaryBox = addGroup(container, PRIMARY_GROUP_TITLE, "", false);
    for (const provider of groups.primary) {
      renderRunRow(provider, primaryBox, false);
    }
    const experimentalBox = addGroup(container, "Experimental", "", true);
    for (const provider of groups.experimental) {
      renderRunRow(provider, experimentalBox, true);
    }
  }
  fillRunProviderList(document.getElementById("runProviders"));
  const progress = document.getElementById("runProgress");
  if (progress) {
    progress.innerHTML = "";
    for (const item of state.runItems || []) {
      const prefix = item.campaign_name ? `${item.campaign_name} · ` : "";
      appendRunProgressLine(progress, item, prefix);
    }
  }
  const groupProgress = document.getElementById("groupProgress");
  if (groupProgress) {
    groupProgress.innerHTML = "";
    for (const item of state.runItems || []) {
      const prefix = `${item.campaign_name || "Campaign"} · `;
      appendRunProgressLine(groupProgress, item, prefix);
    }
  }
  renderSync(state);
  const startRun = document.getElementById("startRun");
  if (startRun) startRun.disabled = state.running || !state.paired;
  const retryFailedRun = document.getElementById("retryFailedRun");
  if (retryFailedRun) {
    retryFailedRun.disabled =
      state.running ||
      !state.paired ||
      !(state.retryFailedCount > 0);
  }
  const stopRun = document.getElementById("stopRun");
  if (stopRun) stopRun.disabled = !state.running;
}

window.renderWatch = render;

try {
  const tabs = document.querySelectorAll(".tabs button");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      userPickedTab = true;
      showTab(tab.dataset.tab);
    });
  });

  const camoufoxHelpGo = document.getElementById("camoufoxHelpGo");
  if (camoufoxHelpGo) {
    camoufoxHelpGo.addEventListener("click", () => {
      const dialog = document.getElementById("camoufoxHelpDialog");
      if (dialog && typeof dialog.close === "function") dialog.close();
      userPickedTab = true;
      showTab("providers");
      const callout = document.getElementById("setupPythonCallout");
      const setupPython = document.getElementById("setupPython");
      if (callout && !callout.hidden && setupPython) setupPython.focus();
    });
  }

  const coverageDialog = document.getElementById("coverageDialog");
  const coverageHelpBtn = document.getElementById("coverageHelpBtn");
  if (coverageHelpBtn && coverageDialog) {
    coverageHelpBtn.addEventListener("click", () => {
      if (typeof coverageDialog.showModal === "function") {
        coverageDialog.showModal();
      }
    });
  }

  const advancedDialog = document.getElementById("advancedDialog");
  function openAdvanced() {
    if (advancedDialog && typeof advancedDialog.showModal === "function") {
      advancedDialog.showModal();
    }
  }
  const openAdvancedBtn = document.getElementById("openAdvancedBtn");
  if (openAdvancedBtn) openAdvancedBtn.addEventListener("click", openAdvanced);
  const advancedForm = document.getElementById("advancedForm");
  if (advancedForm) {
    advancedForm.addEventListener("submit", (event) => {
      const submitter = event.submitter;
      if (submitter && submitter.value === "close") return;
      event.preventDefault();
    });
  }
  const addCustomSchedule = document.getElementById("addCustomSchedule");
  if (addCustomSchedule) {
    addCustomSchedule.addEventListener("click", () => {
      draftSeq += 1;
      customDrafts.push({
        id: `draft:${draftSeq}`,
        companyIds: [],
        weekday: 1,
        hour: 9,
        enabled: true,
      });
      if (latestState) render(latestState);
    });
  }

  const pairForm = document.getElementById("pairForm");
  const pairBtn = document.getElementById("pairBtn");
  if (pairForm && pairForm.dataset.watchBound !== "1") {
    pairForm.dataset.watchBound = "1";
    pairForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("");
      text("pairError", "");
      text("pairStatus", "Pairing…");
        setBusy(pairBtn, true, "Pair campaign", "Pairing…");
      if (!api || typeof api.pair !== "function") {
        const msg =
          "Watch preload failed to load. Quit the app fully, then run pnpm --filter @oppvera/watch-desktop dev.";
        setError(msg);
        text("pairError", msg);
        text("pairStatus", msg);
        setBusy(pairBtn, false, "Pair campaign", "Pairing…");
        return;
      }
      try {
        const state = await api.pair({
          apiBase: document.getElementById("apiBase").value,
          code: document.getElementById("code").value,
          label: document.getElementById("label").value,
        });
        const code = document.getElementById("code");
        if (code) code.value = "";
        render(state);
        if (state && state.paired) {
          userPickedTab = false;
          didInitialTab = false;
          showTab("bank");
          didInitialTab = true;
        }
      } catch (error) {
        const message = error.message || String(error);
        setError(message);
        text("pairError", message);
        text("pairStatus", message);
      } finally {
        setBusy(pairBtn, false, "Pair campaign", "Pairing…");
      }
    });
  }

  const unpairBtn = document.getElementById("unpairBtn");
  if (unpairBtn) {
    unpairBtn.onclick = async () => {
      if (!api) return;
      await api.unpair({ all: true });
      userPickedTab = true;
      showTab("pair");
    };
  }
  const refreshBank = document.getElementById("refreshBank");
  if (refreshBank) {
    refreshBank.onclick = () =>
      api && api.refreshBank().catch((error) => setError(error.message));
  }
  const selectAllQueries = document.getElementById("selectAllQueries");
  if (selectAllQueries) {
    selectAllQueries.onclick = () => {
      if (!api || typeof api.getState !== "function") return;
      void api.getState().then((state) => {
        for (const query of state.queries || []) {
          querySelection.add(query.query_item_id);
        }
        render(state);
      });
    };
  }
  const clearQueries = document.getElementById("clearQueries");
  if (clearQueries) {
    clearQueries.onclick = () => {
      querySelection.clear();
      if (api && typeof api.getState === "function") {
        void api.getState().then((state) => render(state));
      }
    };
  }
  async function runPythonSetup(button, idleLabel) {
    if (!api || typeof api.setupPython !== "function") return;
    pythonBusy = true;
    setError("");
    showPythonProgress({
      step: 0,
      total: 4,
      label: "Starting Camoufox setup",
    });
    const callout = document.getElementById("setupPythonCallout");
    const retryPython = document.getElementById("retryPython");
    if (callout) callout.hidden = true;
    if (retryPython) retryPython.hidden = true;
    if (button && button.id === "setupPython") {
      setupCalloutDismissed = true;
      button.hidden = false;
      setBusy(button, true, idleLabel, "Setting up…");
    }
    try {
      const state = await api.setupPython();
      pythonBusy = false;
      render(state);
      if (state && state.python && !state.python.ok) {
        setupCalloutDismissed = false;
        text(
          "pythonHelp",
          state.python.message || "Camoufox setup did not finish.",
        );
      }
    } catch (error) {
      setupCalloutDismissed = false;
      const message = error.message || String(error);
      setError(message);
      text("pythonHelp", message);
      setPythonProgressDetail("");
      if (api && typeof api.getState === "function") {
        void api.getState().then((state) => render(state));
      }
    } finally {
      pythonBusy = false;
      if (button && button.id === "setupPython") {
        setBusy(button, false, idleLabel, "Setting up…");
      }
    }
  }

  const setupPython = document.getElementById("setupPython");
  if (setupPython) {
    setupPython.onclick = () => runPythonSetup(setupPython, "Set up Camoufox Python");
  }
  const retryPython = document.getElementById("retryPython");
  if (retryPython) {
    retryPython.onclick = () => runPythonSetup(retryPython, "Set up Camoufox Python");
  }
  const syncNow = document.getElementById("syncNow");
  if (syncNow) {
    syncNow.onclick = async () => {
      if (!api) return;
      setError("");
      setBusy(syncNow, true, "Sync now", "Syncing…");
      try {
        await api.syncNow();
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(syncNow, false, "Sync now", "Syncing…");
      }
    };
  }
  const startRun = document.getElementById("startRun");
  if (startRun) {
    startRun.onclick = async () => {
      const selected = [
        ...document.querySelectorAll("#runProviders input:checked"),
      ].map((input) => input.value);
      setError("");
      setBusy(startRun, true, "Run query bank", "Running…");
      try {
        await api.startRun({
          providers: selected,
          queryItemIds: selectedQueryItemIds(),
        });
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(startRun, false, "Run query bank", "Running…");
      }
    };
  }
  const retryFailedRun = document.getElementById("retryFailedRun");
  if (retryFailedRun) {
    retryFailedRun.onclick = async () => {
      const selected = [
        ...document.querySelectorAll("#runProviders input:checked"),
      ].map((input) => input.value);
      setError("");
      setBusy(retryFailedRun, true, "Retry failed only", "Retrying…");
      try {
        await api.retryFailedRun({ providers: selected });
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(retryFailedRun, false, "Retry failed only", "Retrying…");
      }
    };
  }
  const stopRun = document.getElementById("stopRun");
  if (stopRun) {
    stopRun.onclick = async () => {
      if (!api || typeof api.stopRun !== "function") return;
      setBusy(stopRun, true, "Stop", "Stopping…");
      try {
        await api.stopRun();
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(stopRun, false, "Stop", "Stopping…");
      }
    };
  }

  if (api && typeof api.onPythonProgress === "function") {
    api.onPythonProgress((progress) => {
      if (!pythonBusy) return;
      showPythonProgress(progress);
    });
  }

  if (api && typeof api.onLog === "function") {
    api.onLog(({ level, message }) => {
      const prefix = `[watch capture${level && level !== "log" ? ` ${level}` : ""}]`;
      if (level === "error") {
        console.error(prefix, message);
      } else if (level === "warn") {
        console.warn(prefix, message);
      } else {
        console.log(prefix, message);
      }
    });
  }

  const labelForm = document.getElementById("providerAccountLabelForm");
  const labelCancel = document.getElementById("providerAccountLabelCancel");
  const labelDialog = document.getElementById("providerAccountLabelDialog");
  labelForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("providerAccountLabelInput");
    const named = input?.value.trim() || "";
    if (!named) return;
    closeAccountLabelDialog(named);
  });
  labelCancel?.addEventListener("click", () => closeAccountLabelDialog(null));
  labelDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeAccountLabelDialog(null);
  });

  if (api && typeof api.onState === "function") {
    api.onState(render);
    api.getState().then(render).catch((error) => {
      text("pairStatus", error.message || String(error));
    });
  } else {
    const msg =
      "Watch preload failed to load. Quit the app fully, then run pnpm --filter @oppvera/watch-desktop dev.";
    setError(msg);
    text("pairError", msg);
    text("pairStatus", msg);
  }
} catch (error) {
  text("pairStatus", error.message || String(error));
  text("pairError", error.message || String(error));
}
})();
