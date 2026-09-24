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

function readSessionMode() {
  const checked = document.querySelector("#sessionMode input:checked");
  return checked && checked.value ? checked.value : "both";
}

function render(state) {
  if (!state) return;
  text("python-status", state.python && state.python.message);
  if (!pythonBusy) {
    text("pythonHelp", state.python && state.python.message);
  }
  text("pairError", state.lastError || "");
  setError(state.lastError || "");
  const pairedCard = document.getElementById("pairedCard");
  const pairSetup = document.getElementById("pairSetup");
  const pairStatus = document.getElementById("pairStatus");
  if (state.paired && state.device) {
    const summary = `${state.device.company_name} / ${state.device.campaign_name}`;
    text("campaignHint", summary);
    text("pairedSummary", `Paired with ${summary}`);
    if (pairStatus) pairStatus.textContent = state.device.api_base;
    if (pairedCard) pairedCard.hidden = false;
    if (pairSetup) pairSetup.hidden = true;
    const apiBase = document.getElementById("apiBase");
    if (apiBase && state.device.api_base) apiBase.value = state.device.api_base;
  } else {
    text("campaignHint", "Pair this Mac to a campaign to start.");
    text("pairedSummary", "");
    if (pairStatus) pairStatus.textContent = "Not paired.";
    if (pairedCard) pairedCard.hidden = true;
    if (pairSetup) pairSetup.hidden = false;
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
    for (const provider of state.providers || []) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<span>${provider.id}${provider.connected ? " · connected" : ""}${
        provider.error ? ` · ${provider.error}` : ""
      }</span>`;
      const actions = document.createElement("div");
      const connect = document.createElement("button");
      connect.className = "ghost";
      connect.type = "button";
      connect.textContent = "Connect";
      connect.onclick = async () => {
        setError("");
        setBusy(connect, true, "Connect", "Opening sign-in…");
        try {
          await api.connectProvider(provider.id);
        } catch (error) {
          setError(error.message || String(error));
        } finally {
          setBusy(connect, false, "Connect", "Opening sign-in…");
        }
      };
      const reset = document.createElement("button");
      reset.className = "ghost";
      reset.type = "button";
      reset.textContent = "Reset";
      reset.onclick = async () => {
        await api.resetProvider(provider.id);
      };
      actions.append(connect, reset);
      row.appendChild(actions);
      providerList.appendChild(row);
    }
  }
  const runProviders = document.getElementById("runProviders");
  if (runProviders) {
    const previous = new Set(
      [...runProviders.querySelectorAll("input:checked")].map((input) => input.value),
    );
    const hadBoxes = Boolean(runProviders.querySelector("input"));
    const mode = readSessionMode();
    document.querySelectorAll("#sessionMode input").forEach((input) => {
      input.disabled = state.running;
    });
    runProviders.innerHTML = "";
    for (const provider of state.runtimeProviders || []) {
      const needsLogin = mode === "signed-in" && !provider.connected;
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = provider.id;
      box.disabled = state.running || needsLogin;
      if (hadBoxes) {
        box.checked = previous.has(provider.id) && !needsLogin;
      } else {
        box.checked = mode === "signed-in" ? provider.connected : true;
      }
      const suffix =
        provider.connected
          ? " · connected"
          : mode === "signed-in"
            ? " (connect first)"
            : " · signed-out";
      label.append(box, document.createTextNode(` ${provider.id}${suffix}`));
      runProviders.appendChild(label);
    }
  }
  const progress = document.getElementById("runProgress");
  if (progress) {
    progress.innerHTML = "";
    for (const item of state.runItems || []) {
      const li = document.createElement("li");
      li.textContent = `${item.provider} · ${item.session || "signed-in"} · ${item.question} · ${item.status}${
        item.error ? ` · ${item.error}` : ""
      }`;
      progress.appendChild(li);
    }
  }
  text(
    "syncStatus",
    state.paired
      ? `${state.pendingSync} waiting to sync.${state.lastSyncAt ? ` Last success: ${state.lastSyncAt}` : ""}`
      : "Pair before syncing.",
  );
  const startRun = document.getElementById("startRun");
  if (startRun) startRun.disabled = state.running || !state.paired;
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

  const pairForm = document.getElementById("pairForm");
  const pairBtn = document.getElementById("pairBtn");
  if (pairForm && pairForm.dataset.watchBound !== "1") {
    pairForm.dataset.watchBound = "1";
    pairForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("");
      text("pairError", "");
      text("pairStatus", "Pairing…");
      setBusy(pairBtn, true, "Pair this Mac", "Pairing…");
      if (!api || typeof api.pair !== "function") {
        const msg =
          "Watch preload failed to load. Quit the app fully, then run pnpm --filter @oppvera/watch-desktop dev.";
        setError(msg);
        text("pairError", msg);
        text("pairStatus", msg);
        setBusy(pairBtn, false, "Pair this Mac", "Pairing…");
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
        setBusy(pairBtn, false, "Pair this Mac", "Pairing…");
      }
    });
  }

  const unpairBtn = document.getElementById("unpairBtn");
  if (unpairBtn) {
    unpairBtn.onclick = async () => {
      if (!api) return;
      await api.unpair();
      userPickedTab = true;
      showTab("pair");
    };
  }
  const refreshBank = document.getElementById("refreshBank");
  if (refreshBank) {
    refreshBank.onclick = () =>
      api && api.refreshBank().catch((error) => setError(error.message));
  }
  const setupPython = document.getElementById("setupPython");
  if (setupPython) {
    setupPython.onclick = async () => {
      if (!api || typeof api.setupPython !== "function") return;
      pythonBusy = true;
      setError("");
      text("pythonHelp", "Setting up Camoufox Python… this can take a few minutes.");
      setBusy(setupPython, true, "Set up Camoufox Python", "Setting up…");
      try {
        const state = await api.setupPython();
        pythonBusy = false;
        render(state);
      } catch (error) {
        setError(error.message || String(error));
        text("pythonHelp", error.message || String(error));
      } finally {
        pythonBusy = false;
        setBusy(setupPython, false, "Set up Camoufox Python", "Setting up…");
      }
    };
  }
  const syncNow = document.getElementById("syncNow");
  if (syncNow) {
    syncNow.onclick = () =>
      api && api.syncNow().catch((error) => setError(error.message));
  }
  const sessionMode = document.getElementById("sessionMode");
  if (sessionMode) {
    sessionMode.addEventListener("change", () => {
      if (api && typeof api.getState === "function") {
        api.getState().then(render);
      }
    });
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
          sessionMode: readSessionMode(),
        });
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        setBusy(startRun, false, "Run query bank", "Running…");
      }
    };
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
