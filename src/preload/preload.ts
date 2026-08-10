/**
 * The bridge is generated from Object.keys(IPC) so channel exposure cannot drift
 * from the central registry. If the list were hand-written, a later channel might
 * be callable without the metadata phase-audit depends on.
 */
import { contextBridge, ipcRenderer } from "electron";
import { IPC, type IpcChannel } from "../shared/ipc.js";
import type { ReacherBridge } from "./api.js";

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
  }
};

contextBridge.exposeInMainWorld("reacher", bridge);
