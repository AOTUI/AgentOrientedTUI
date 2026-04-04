import { BusEvent, Bus } from "./adapters.js"
import { pathToFileURL, fileURLToPath } from "url"
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node.js"
import type { Diagnostic as VSCodeDiagnostic } from "vscode-languageserver-types"
import { Log, NamedError, withTimeout, Filesystem } from "./adapters.js"
import { LANGUAGE_EXTENSIONS } from "./language.js"
import z from "zod"
import type { LSPServer } from "./server.js"

const DIAGNOSTICS_DEBOUNCE_MS = 150

export namespace LSPClient {
  const log = Log.create({ service: "lsp.client" })

  export type Info = NonNullable<Awaited<ReturnType<typeof create>>>

  export type Diagnostic = VSCodeDiagnostic

  export const InitializeError = NamedError.create(
    "LSPInitializeError",
    z.object({
      serverID: z.string(),
    }),
  )

  export const Event = {
    Diagnostics: BusEvent.define(
      "lsp.client.diagnostics",
      z.object({
        serverID: z.string(),
        path: z.string(),
      }),
    ),
  }

  export async function create(input: { serverID: string; server: LSPServer.Handle; root: string }) {
    const l = log.clone().tag("serverID", input.serverID)
    l.info("starting client")

    const connection = createMessageConnection(
      new StreamMessageReader(input.server.process.stdout as any),
      new StreamMessageWriter(input.server.process.stdin as any),
    )

    const diagnostics = new Map<string, Diagnostic[]>()
    connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const filePath = Filesystem.normalizePath(fileURLToPath(params.uri))
      l.info("textDocument/publishDiagnostics", {
        path: filePath,
        count: params.diagnostics.length,
      })
      const exists = diagnostics.has(filePath)
      diagnostics.set(filePath, params.diagnostics)
      if (!exists && input.serverID === "typescript") return
      Bus.publish(Event.Diagnostics, { path: filePath, serverID: input.serverID })
    })
    connection.onRequest("window/workDoneProgress/create", (params) => {
      l.info("window/workDoneProgress/create", params)
      return null
    })
    connection.onRequest("workspace/configuration", async () => {
      // Return server initialization options
      return [input.server.initialization ?? {}]
    })
    connection.onRequest("client/registerCapability", async () => { })
    connection.onRequest("client/unregisterCapability", async () => { })
    connection.onRequest("workspace/workspaceFolders", async () => [
      {
        name: "workspace",
        uri: pathToFileURL(input.root).href,
      },
    ])
    connection.listen()

    l.info("sending initialize")
    await withTimeout(
      connection.sendRequest("initialize", {
        rootUri: pathToFileURL(input.root).href,
        processId: input.server.process.pid,
        workspaceFolders: [
          {
            name: "workspace",
            uri: pathToFileURL(input.root).href,
          },
        ],
        initializationOptions: {
          ...input.server.initialization,
        },
        capabilities: {
          window: {
            workDoneProgress: true,
          },
          workspace: {
            configuration: true,
            didChangeWatchedFiles: {
              dynamicRegistration: true,
            },
          },
          textDocument: {
            synchronization: {
              didOpen: true,
              didChange: true,
            },
            publishDiagnostics: {
              versionSupport: true,
            },
          },
        },
      }),
      45_000,
    ).catch((err) => {
      const lspError = new InitializeError(
        { serverID: input.serverID },
        {
          cause: err,
        },
      );
      l.error("initialize error", { error: err })
      throw lspError
    })

    await connection.sendNotification("initialized", {})

    if (input.server.initialization) {
      await connection.sendNotification("workspace/didChangeConfiguration", {
        settings: input.server.initialization,
      })
    }

    const files: {
      [path: string]: number
    } = {}

    const result = {
      root: input.root,
      get serverID() {
        return input.serverID
      },
      get connection() {
        return connection
      },
      notify: {
        open: async (params: { path: string }) => {
          if (files[params.path]) return
          files[params.path] = 1
          await connection.sendNotification("textDocument/didOpen", {
            textDocument: {
              uri: pathToFileURL(params.path).href,
              languageId: LANGUAGE_EXTENSIONS[("." + params.path.split(".").pop()) as keyof typeof LANGUAGE_EXTENSIONS] || "plaintext",
              version: 1,
              text: await Filesystem.readFile(params.path).catch(() => ""),
            },
          })
        },
      },
      waitForDiagnostics: async (params: { path: string }) => {
        // Simplified implementation because we don't have Bus
        return new Promise<void>((resolve) => {
          setTimeout(resolve, 500); // Simple delay
        });
      },
      get diagnostics() {
        return diagnostics
      },
      shutdown: async () => {
        try {
          await connection.sendRequest("shutdown")
          await connection.sendNotification("exit")
          connection.dispose()
          input.server.process.kill()
        } catch (e) {
          l.error("shutdown error", { error: e })
        }
      },
    }

    return result
  }
}
