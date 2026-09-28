(() => {
const api = window.watch;
let pythonBusy = false;
let userPickedTab = false;
let didInitialTab = false;

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

function setError(message) {
  text("error", message);
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

const PRIMARY_AUTH = ["chatgpt", "claude"];
const EXPERIMENTAL_AUTH = ["gemini", "google", "perplexity"];
const PRIMARY_RUN = ["chatgpt", "claude"];
const EXPERIMENTAL_RUN = ["gemini", "ai-overview", "perplexity"];

function displayName(map, id) {
  return map[id] || id;
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
    headline.textContent = `${pending} ${captureWord(pending)} waiting on this Mac`;
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

function render(state) {
  if (!state) return;
  text(
    "appVersion",
    state.appVersionLabel ||
      (state.appVersion ? `Oppvera Watch v${state.appVersion}` : "Oppvera Watch"),
  );
  text("python-status", state.python && state.python.message);
  if (!pythonBusy) {
    text("pythonHelp", state.python && state.python.message);
  }
  const pythonReady = Boolean(state.python && state.python.ok);
  const setupPython = document.getElementById("setupPython");
  const retryPython = document.getElementById("retryPython");
  if (setupPython) setupPython.hidden = pythonReady || pythonBusy;
  if (retryPython) retryPython.hidden = !pythonReady || pythonBusy;
  text("pairError", state.lastError || "");
  setError(state.lastError || "");
  const pairBtn = document.getElementById("pairBtn");
  const pairStatus = document.getElementById("pairStatus");
  const campaigns = state.campaigns || [];
  const campaignList = document.getElementById("campaignList");
  if (campaignList) {
    campaignList.innerHTML = "";
    for (const campaign of campaigns) {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      label.className = "campaign-active";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "activeCampaign";
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
      label.append(
        radio,
        document.createTextNode(
          ` ${campaign.company_name} / ${campaign.campaign_name}`,
        ),
      );
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
      campaignList.appendChild(row);
    }
    if (campaigns.length > 1) {
      const all = document.createElement("button");
      all.className = "ghost";
      all.type = "button";
      all.textContent = "Remove all campaigns";
      all.disabled = state.running;
      all.onclick = async () => {
        if (!api) return;
        render(await api.unpair({ all: true }));
      };
      campaignList.appendChild(all);
    }
  }
  if (state.paired && state.device) {
    const summary = `${state.device.company_name} / ${state.device.campaign_name}`;
    text("campaignHint", summary);
    if (pairStatus) pairStatus.textContent = state.device.api_base;
    const apiBase = document.getElementById("apiBase");
    if (apiBase && state.device.api_base) apiBase.value = state.device.api_base;
    if (pairBtn) pairBtn.textContent = "Add campaign";
  } else {
    text("campaignHint", "Pair this Mac to a campaign to start.");
    if (pairStatus) pairStatus.textContent = "Not paired.";
    if (pairBtn) pairBtn.textContent = "Add campaign";
  }
  if (!didInitialTab && !userPickedTab) {
    didInitialTab = true;
    showTab(state.paired ? "bank" : "pair");
  }
  const queryList = document.getElementById("queryList");
  if (queryList) {
    queryList.innerHTML = "";
    if (!state.queries || !state.queries.length) {
      queryList.innerHTML =
        "<li>No questions yet. Add a query bank in Oppvera, then refresh.</li>";
    } else {
      for (const query of state.queries) {
        const item = document.createElement("li");
        item.textContent = query.text;
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
      row.innerHTML = `<span>${label}${provider.connected ? " · connected" : ""}${
        provider.error ? ` · ${provider.error}` : ""
      }</span>`;
      const actions = document.createElement("div");
      const action = document.createElement("button");
      action.className = "ghost";
      action.type = "button";
      if (provider.connected) {
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
          setBusy(action, true, "Connect", "Waiting for sign-in…");
          try {
            await api.connectProvider(provider.id);
          } catch (error) {
            setError(error.message || String(error));
          } finally {
            setBusy(action, false, "Connect", "Waiting for sign-in…");
          }
        };
      }
      actions.append(action);
      row.appendChild(actions);
      target.appendChild(row);
    };
    const primaryBox = addGroup(
      providerList,
      "ChatGPT and Claude",
      "ChatGPT: free and Plus. Claude: free only.",
      false,
    );
    for (const provider of groups.primary) renderAuthRow(provider, primaryBox);
    const experimentalBox = addGroup(
      providerList,
      "Experimental",
      "Gemini, Google, and Perplexity have not been tested yet.",
      true,
    );
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
    const primaryBox = addGroup(
      container,
      "ChatGPT and Claude",
      "ChatGPT: free and Plus. Claude: free only.",
      false,
    );
    for (const provider of groups.primary) {
      renderRunRow(provider, primaryBox, false);
    }
    const experimentalBox = addGroup(
      container,
      "Experimental",
      "Not tested yet (Gemini, Google AI Overview, Perplexity).",
      true,
    );
    for (const provider of groups.experimental) {
      renderRunRow(provider, experimentalBox, true);
    }
  }
  fillRunProviderList(document.getElementById("runProviders"));
  fillRunProviderList(document.getElementById("groupProviders"));
  const progress = document.getElementById("runProgress");
  if (progress) {
    progress.innerHTML = "";
    for (const item of state.runItems || []) {
      const li = document.createElement("li");
      li.textContent = `${item.campaign_name ? `${item.campaign_name} · ` : ""}${displayName(RUN_DISPLAY, item.provider)} · ${item.question} · ${item.status}${
        item.error ? ` · ${item.error}` : ""
      }`;
      progress.appendChild(li);
    }
  }
  const groupProgress = document.getElementById("groupProgress");
  if (groupProgress) {
    groupProgress.innerHTML = "";
    for (const item of state.runItems || []) {
      const li = document.createElement("li");
      li.textContent = `${item.campaign_name || "Campaign"} · ${displayName(RUN_DISPLAY, item.provider)} · ${item.question} · ${item.status}${
        item.error ? ` · ${item.error}` : ""
      }`;
      groupProgress.appendChild(li);
    }
  }
  const maxGroup = document.getElementById("maxGroupSize");
  if (maxGroup && document.activeElement !== maxGroup) {
    maxGroup.value = String(state.maxGroupSize || 2);
  }
  const groupCampaigns = document.getElementById("groupCampaigns");
  if (groupCampaigns) {
    const previous = new Set(
      [...groupCampaigns.querySelectorAll("input:checked")].map((input) => input.value),
    );
    const had = Boolean(groupCampaigns.querySelector("input"));
    groupCampaigns.innerHTML = "";
    const cap = Number(state.maxGroupSize || 2);
    const list = state.campaigns || [];
    for (const campaign of list) {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = campaign.campaign_id;
      box.disabled = state.running;
      box.checked = had
        ? previous.has(campaign.campaign_id)
        : state.device && state.device.campaign_id === campaign.campaign_id;
      label.append(
        box,
        document.createTextNode(` ${campaign.company_name} / ${campaign.campaign_name}`),
      );
      groupCampaigns.appendChild(label);
    }
    const checked = [...groupCampaigns.querySelectorAll("input:checked")];
    if (checked.length > cap) {
      checked.slice(cap).forEach((input) => {
        input.checked = false;
      });
    }
  }
  renderSync(state);
  const startRun = document.getElementById("startRun");
  if (startRun) startRun.disabled = state.running || !state.paired;
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
  const appVersion = document.getElementById("appVersion");
  let versionClicks = 0;
  let versionClickTimer = 0;
  function openAdvanced() {
    if (advancedDialog && typeof advancedDialog.showModal === "function") {
      advancedDialog.showModal();
    }
  }
  if (appVersion) {
    appVersion.addEventListener("click", (event) => {
      if (event.altKey) {
        openAdvanced();
        versionClicks = 0;
        return;
      }
      versionClicks += 1;
      window.clearTimeout(versionClickTimer);
      versionClickTimer = window.setTimeout(() => {
        versionClicks = 0;
      }, 2000);
      if (versionClicks >= 7) {
        versionClicks = 0;
        openAdvanced();
      }
    });
  }
  const maxGroup = document.getElementById("maxGroupSize");
  if (maxGroup) {
    maxGroup.onchange = async () => {
      if (!api || typeof api.setMaxGroupSize !== "function") return;
      try {
        render(await api.setMaxGroupSize(Number(maxGroup.value)));
      } catch (error) {
        setError(error.message || String(error));
      }
    };
  }
  const startGroupRun = document.getElementById("startGroupRun");
  if (startGroupRun) {
    startGroupRun.onclick = async () => {
      const campaignIds = [
        ...document.querySelectorAll("#groupCampaigns input:checked"),
      ].map((input) => input.value);
      const selected = [
        ...document.querySelectorAll("#groupProviders input:checked"),
      ].map((input) => input.value);
      setError("");
      setBusy(startGroupRun, true, "Run selected campaigns", "Running…");
      try {
        await api.startGroupRun({ providers: selected, campaignIds });
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(startGroupRun, false, "Run selected campaigns", "Running…");
      }
    };
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
        setBusy(pairBtn, true, "Add campaign", "Pairing…");
      if (!api || typeof api.pair !== "function") {
        const msg =
          "Watch preload failed to load. Quit the app fully, then run pnpm --filter @oppvera/watch-desktop dev.";
        setError(msg);
        text("pairError", msg);
        text("pairStatus", msg);
        setBusy(pairBtn, false, "Add campaign", "Pairing…");
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
        setBusy(pairBtn, false, "Add campaign", "Pairing…");
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
  async function runPythonSetup(button, idleLabel) {
    if (!api || typeof api.setupPython !== "function") return;
    pythonBusy = true;
    setError("");
    text("pythonHelp", "Setting up Camoufox Python… this can take a few minutes.");
    const setupPython = document.getElementById("setupPython");
    const retryPython = document.getElementById("retryPython");
    if (setupPython) setupPython.hidden = true;
    if (retryPython) retryPython.hidden = true;
    if (button && button.id === "setupPython") {
      button.hidden = false;
      setBusy(button, true, idleLabel, "Setting up…");
    }
    try {
      const state = await api.setupPython();
      pythonBusy = false;
      render(state);
      if (state && state.python && !state.python.ok) {
        text(
          "pythonHelp",
          state.python.message || "Camoufox setup did not finish.",
        );
      }
    } catch (error) {
      const message = error.message || String(error);
      setError(message);
      text("pythonHelp", message);
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
        });
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(startRun, false, "Run query bank", "Running…");
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
