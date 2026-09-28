const { contextBridge, ipcRenderer } = require("electron");

console.log("[watch] preload loaded");

contextBridge.exposeInMainWorld("watch", {
	getState: () => ipcRenderer.invoke("watch:getState"),
	pair: (payload) => ipcRenderer.invoke("watch:pair", payload),
	unpair: (payload) => ipcRenderer.invoke("watch:unpair", payload),
	setActiveCampaign: (campaignId) =>
		ipcRenderer.invoke("watch:setActiveCampaign", campaignId),
	setMaxGroupSize: (value) => ipcRenderer.invoke("watch:setMaxGroupSize", value),
	startGroupRun: (payload) => ipcRenderer.invoke("watch:startGroupRun", payload),
	refreshBank: () => ipcRenderer.invoke("watch:refreshBank"),
	connectProvider: (provider) =>
		ipcRenderer.invoke("watch:connectProvider", provider),
	resetProvider: (provider) =>
		ipcRenderer.invoke("watch:resetProvider", provider),
	startRun: (payload) => ipcRenderer.invoke("watch:startRun", payload),
	stopRun: () => ipcRenderer.invoke("watch:stopRun"),
	syncNow: () => ipcRenderer.invoke("watch:syncNow"),
	setupPython: () => ipcRenderer.invoke("watch:setupPython"),
	onState: (handler) => {
		const listener = (_event, state) => handler(state);
		ipcRenderer.on("watch:state", listener);
		return () => ipcRenderer.removeListener("watch:state", listener);
	},
	onLog: (handler) => {
		const listener = (_event, payload) => handler(payload);
		ipcRenderer.on("watch:log", listener);
		return () => ipcRenderer.removeListener("watch:log", listener);
	},
});
