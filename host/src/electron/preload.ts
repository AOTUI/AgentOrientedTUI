import { contextBridge, ipcRenderer } from 'electron';
import { exposeElectronTRPC } from 'electron-trpc/main';

process.once('loaded', async () => {
  exposeElectronTRPC();
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
  },
});
