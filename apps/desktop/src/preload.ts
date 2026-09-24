import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("watch", {
	getState: () => ipcRenderer.invoke("watch:getState"),
	pair: (payload: { apiBase: string; code: string; label: string }) =>
		ipcRenderer.invoke("watch:pair", payload),
	unpair: () => ipcRenderer.invoke("watch:unpair"),
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
});
