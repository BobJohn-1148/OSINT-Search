/**
 * The bridge is generated from Object.keys(IPC) so channel exposure cannot drift
 * from the central registry. If the list were hand-written, a later channel might
 * be callable without the metadata phase-audit depends on.
 */
import { contextBridge, ipcRenderer } from "electron";
import { IPC, type IpcChannel } from "../shared/ipc.js";
import type { AgentEventMap, ReacherBridge, SearchEventMap } from "./api.js";

const channels = Object.keys(IPC) as IpcChannel[];

const bridge: ReacherBridge = {
  channels,
  invoke: (channel, request) => {
    if (!channels.includes(channel)) {
      return Promise.resolve({
        ok: false,
        error: {
          code: "UNKNOWN_CHANNEL",
          message: `Channel ${channel} is not declared in the IPC registry`
        }
      });
    }

    return ipcRenderer.invoke(channel, request);
  },
  onSearchEvent: (event, listener) => {
    const allowedEvents: readonly (keyof SearchEventMap)[] = ["search:source-returned", "search:observations"];
    if (!allowedEvents.includes(event)) {
      return () => {};
    }

    const wrapped = (_ipcEvent: Electron.IpcRendererEvent, payload: SearchEventMap[typeof event]) => listener(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
  onAgentEvent: (event, listener) => {
    const allowedEvents: readonly (keyof AgentEventMap)[] = ["agent:events"];
    if (!allowedEvents.includes(event)) {
      return () => {};
    }

    const wrapped = (_ipcEvent: Electron.IpcRendererEvent, payload: AgentEventMap[typeof event]) => listener(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  }
};

contextBridge.exposeInMainWorld("reacher", bridge);
