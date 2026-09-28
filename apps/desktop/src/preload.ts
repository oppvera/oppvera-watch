import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("watch", {
	getState: () => ipcRenderer.invoke("watch:getState"),
	pair: (payload: { apiBase: string; code: string; label: string }) =>
		ipcRenderer.invoke("watch:pair", payload),
	unpair: (payload?: { campaignId?: string; all?: boolean }) =>
		ipcRenderer.invoke("watch:unpair", payload),
	setActiveCampaign: (campaignId: string) =>
		ipcRenderer.invoke("watch:setActiveCampaign", campaignId),
	setMaxGroupSize: (value: number) =>
		ipcRenderer.invoke("watch:setMaxGroupSize", value),
	startGroupRun: (payload: { providers: string[]; campaignIds: string[] }) =>
		ipcRenderer.invoke("watch:startGroupRun", payload),
	refreshBank: () => ipcRenderer.invoke("watch:refreshBank"),
	connectProvider: (provider: string) =>
		ipcRenderer.invoke("watch:connectProvider", provider),
	resetProvider: (provider: string) =>
		ipcRenderer.invoke("watch:resetProvider", provider),
	startRun: (payload: { providers: string[] }) =>
		ipcRenderer.invoke("watch:startRun", payload),
	stopRun: () => ipcRenderer.invoke("watch:stopRun"),
	syncNow: () => ipcRenderer.invoke("watch:syncNow"),
	setupPython: () => ipcRenderer.invoke("watch:setupPython"),
	onState: (handler: (state: unknown) => void) => {
		const listener = (_event: unknown, state: unknown) => handler(state);
		ipcRenderer.on("watch:state", listener);
		return () => ipcRenderer.removeListener("watch:state", listener);
	},
	onLog: (handler: (payload: unknown) => void) => {
		const listener = (_event: unknown, payload: unknown) => handler(payload);
		ipcRenderer.on("watch:log", listener);
		return () => ipcRenderer.removeListener("watch:log", listener);
	},
});
