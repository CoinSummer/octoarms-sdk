import { readFile } from "node:fs/promises"
import path from "node:path"

import type { RequestFn } from "./data_api.js"

export type MigrateOptions = {
  taskName: string
  taskVersion: string
  migrationVersion: string
  capabilityEndpoint: string
  ephemeralToken: string
  migrationIndex: Record<string, string>
  taskRootDir: string
}

export type MigrateResult = {
  status: "success"
}

const normalizeBaseUrl = (raw: string): string => {
  const base = raw.trim()
  if (!base) {
    return ""
  }
  return base.replace(/\/+$/, "")
}

const defaultRequest: RequestFn = async (url, method, headers, body) => {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(20_000),
  })

  return {
    status: response.status,
    text: await response.text(),
  }
}

const resolveSqlPath = (taskRootDir: string, relativePath: string): string => {
  const root = path.resolve(taskRootDir)
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`migration file escapes task root: ${relativePath}`)
  }
  return target
}

export const migrate = async (options: MigrateOptions, requestFn?: RequestFn): Promise<MigrateResult> => {
  const relativePath = options.migrationIndex[options.migrationVersion]
  if (!relativePath) {
    throw new Error(`migration version not found in migrationIndex: ${options.migrationVersion}`)
  }

  const baseUrl = normalizeBaseUrl(options.capabilityEndpoint)
  if (!baseUrl) {
    throw new Error("capabilityEndpoint is empty")
  }

  const sqlPath = resolveSqlPath(options.taskRootDir, relativePath)
  const sql = await readFile(sqlPath, "utf-8")

  const endpoint = `${baseUrl}/api/internal/capability/migrations/apply`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const token = options.ephemeralToken.trim()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const body = JSON.stringify({
    task_name: options.taskName,
    task_version: options.taskVersion,
    migration_version: options.migrationVersion,
    sql,
  })

  const request = requestFn ?? defaultRequest
  const { status, text } = await request(endpoint, "POST", headers, body)
  if (status < 200 || status >= 300) {
    throw new Error(`migration apply failed: http ${status} ${text}`)
  }

  return { status: "success" }
}
