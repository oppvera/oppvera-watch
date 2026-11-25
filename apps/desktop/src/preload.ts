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
	saveRunSchedule: (payload: {
		id?: string;
		kind: "company" | "custom";
		enabled: boolean;
		weekday: number;
		hour: number;
		companyIds: string[];
		campaignIds?: string[] | null;
	}) => ipcRenderer.invoke("watch:saveRunSchedule", payload),
	removeRunSchedule: (id: string) =>
		ipcRenderer.invoke("watch:removeRunSchedule", id),
	startGroupRun: (payload: { providers?: string[]; campaignIds: string[] }) =>
		ipcRenderer.invoke("watch:startGroupRun", payload),
	refreshBank: () => ipcRenderer.invoke("watch:refreshBank"),
	campaignBanks: (campaignIds: string[]) =>
		ipcRenderer.invoke("watch:campaignBanks", campaignIds),
	refreshLabels: () => ipcRenderer.invoke("watch:refreshLabels"),
	connectProvider: (provider: string) =>
		ipcRenderer.invoke("watch:connectProvider", provider),
	resetProvider: (provider: string) =>
		ipcRenderer.invoke("watch:resetProvider", provider),
	setProviderAccountLabel: (provider: string, accountLabel: string) =>
		ipcRenderer.invoke("watch:setProviderAccountLabel", provider, accountLabel),
	startRun: (payload: { providers: string[]; queryItemIds?: string[] }) =>
		ipcRenderer.invoke("watch:startRun", payload),
	retryFailedRun: (payload: { providers: string[] }) =>
		ipcRenderer.invoke("watch:retryFailedRun", payload),
	stopRun: () => ipcRenderer.invoke("watch:stopRun"),
	syncNow: () => ipcRenderer.invoke("watch:syncNow"),
	setupPython: () => ipcRenderer.invoke("watch:setupPython"),
	onPythonProgress: (handler: (progress: unknown) => void) => {
		const listener = (_event: unknown, progress: unknown) => handler(progress);
		ipcRenderer.on("watch:pythonProgress", listener);
		return () => ipcRenderer.removeListener("watch:pythonProgress", listener);
	},
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
