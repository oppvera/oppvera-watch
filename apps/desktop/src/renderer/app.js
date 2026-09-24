(() => {
const api = window.watch;

function text(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function setError(message) {
  text("error", message);
}

function render(state) {
  if (!state) return;
  text("python-status", state.python && state.python.message);
  text("pythonHelp", state.python && state.python.message);
  text("pairError", state.lastError || "");
  setError(state.lastError || "");
  const pairStatus = document.getElementById("pairStatus");
  if (pairStatus) {
    if (state.paired && state.device) {
      pairStatus.textContent = `Paired with ${state.device.company_name} / ${state.device.campaign_name} (${state.device.api_base})`;
    } else {
      pairStatus.textContent = "Not paired.";
    }
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
        try {
          await api.connectProvider(provider.id);
        } catch (error) {
          setError(error.message || String(error));
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
    runProviders.innerHTML = "";
    for (const provider of state.runtimeProviders || []) {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = provider.id;
      box.checked = provider.connected;
      box.disabled = !provider.connected || state.running;
      label.append(
        box,
        document.createTextNode(
          ` ${provider.id}${provider.connected ? "" : " (connect first)"}`,
        ),
      );
      runProviders.appendChild(label);
    }
  }
  const progress = document.getElementById("runProgress");
  if (progress) {
    progress.innerHTML = "";
    for (const item of state.runItems || []) {
      const li = document.createElement("li");
      li.textContent = `${item.provider} · ${item.question} · ${item.status}${
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
  const panels = document.querySelectorAll(".panel");
  const tabs = document.querySelectorAll(".tabs button");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById(tab.dataset.tab);
      if (panel) panel.classList.add("active");
    });
  });

  const unpairBtn = document.getElementById("unpairBtn");
  if (unpairBtn) {
    unpairBtn.onclick = () => api && api.unpair();
  }
  const refreshBank = document.getElementById("refreshBank");
  if (refreshBank) {
    refreshBank.onclick = () =>
      api && api.refreshBank().catch((error) => setError(error.message));
  }
  const setupPython = document.getElementById("setupPython");
  if (setupPython) {
    setupPython.onclick = () =>
      api && api.setupPython().catch((error) => setError(error.message));
  }
  const syncNow = document.getElementById("syncNow");
  if (syncNow) {
    syncNow.onclick = () =>
      api && api.syncNow().catch((error) => setError(error.message));
  }
  const startRun = document.getElementById("startRun");
  if (startRun) {
    startRun.onclick = async () => {
      const selected = [
        ...document.querySelectorAll("#runProviders input:checked"),
      ].map((input) => input.value);
      setError("");
      try {
        await api.startRun(selected);
      } catch (error) {
        setError(error.message || String(error));
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
