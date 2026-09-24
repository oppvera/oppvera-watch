const watch = window.watch;

const panels = document.querySelectorAll(".panel");
const tabs = document.querySelectorAll(".tabs button");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    panels.forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

function setError(message) {
  document.getElementById("error").textContent = message || "";
}

function render(state) {
  document.getElementById("python-status").textContent = state.python.message;
  document.getElementById("pythonHelp").textContent = state.python.message;
  const pairStatus = document.getElementById("pairStatus");
  if (state.paired && state.device) {
    pairStatus.textContent = `Paired with ${state.device.company_name} / ${state.device.campaign_name} (${state.device.api_base})`;
  } else {
    pairStatus.textContent = "Not paired.";
  }
  const queryList = document.getElementById("queryList");
  queryList.innerHTML = "";
  if (!state.queries.length) {
    queryList.innerHTML =
      "<li>No questions yet. Add a query bank in Oppvera, then refresh.</li>";
  }
  for (const query of state.queries) {
    const item = document.createElement("li");
    item.textContent = query.text;
    queryList.appendChild(item);
  }
  const providerList = document.getElementById("providerList");
  providerList.innerHTML = "";
  for (const provider of state.providers) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span>${provider.id}${provider.connected ? " · connected" : ""}${
      provider.error ? ` · ${provider.error}` : ""
    }</span>`;
    const actions = document.createElement("div");
    const connect = document.createElement("button");
    connect.className = "ghost";
    connect.textContent = "Connect";
    connect.onclick = async () => {
      setError("");
      try {
        await watch.connectProvider(provider.id);
      } catch (error) {
        setError(error.message || String(error));
      }
    };
    const reset = document.createElement("button");
    reset.className = "ghost";
    reset.textContent = "Reset";
    reset.onclick = async () => {
      await watch.resetProvider(provider.id);
    };
    actions.append(connect, reset);
    row.appendChild(actions);
    providerList.appendChild(row);
  }
  const runProviders = document.getElementById("runProviders");
  runProviders.innerHTML = "";
  for (const provider of state.runtimeProviders || []) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = provider.id;
    box.checked = provider.connected;
    box.disabled = !provider.connected || state.running;
    label.append(box, document.createTextNode(` ${provider.id}${provider.connected ? "" : " (connect first)"}`));
    runProviders.appendChild(label);
  }
  const progress = document.getElementById("runProgress");
  progress.innerHTML = "";
  for (const item of state.runItems) {
    const li = document.createElement("li");
    li.textContent = `${item.provider} · ${item.question} · ${item.status}${
      item.error ? ` · ${item.error}` : ""
    }`;
    progress.appendChild(li);
  }
  document.getElementById("syncStatus").textContent = state.paired
    ? `${state.pendingSync} waiting to sync.${state.lastSyncAt ? ` Last success: ${state.lastSyncAt}` : ""}`
    : "Pair before syncing.";
  document.getElementById("startRun").disabled = state.running || !state.paired;
  if (state.lastError) setError(state.lastError);
}

document.getElementById("pairBtn").onclick = async () => {
  setError("");
  try {
    await watch.pair({
      apiBase: document.getElementById("apiBase").value,
      code: document.getElementById("code").value,
      label: document.getElementById("label").value,
    });
  } catch (error) {
    setError(error.message || String(error));
  }
};

document.getElementById("unpairBtn").onclick = () => watch.unpair();
document.getElementById("refreshBank").onclick = () => watch.refreshBank().catch((error) => setError(error.message));
document.getElementById("setupPython").onclick = () => watch.setupPython().catch((error) => setError(error.message));
document.getElementById("syncNow").onclick = () => watch.syncNow().catch((error) => setError(error.message));
document.getElementById("startRun").onclick = async () => {
  const selected = [...document.querySelectorAll("#runProviders input:checked")].map(
    (input) => input.value,
  );
  setError("");
  try {
    await watch.startRun(selected);
  } catch (error) {
    setError(error.message || String(error));
  }
};

watch.onState(render);
watch.getState().then(render);
