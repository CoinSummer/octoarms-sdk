export type TaskEventType = "record" | "checkpoint" | "log" | "metric"

export type TaskEvent = {
  runId: string
  taskName: string
  taskVersion: string
  attemptNo: number
  seq: number
  eventType: TaskEventType
  payload: Record<string, unknown>
}

export type DataUpsertPayload = {
  runId: string
  taskName: string
  taskVersion: string
  attemptNo: number
  dataset: string
  rows: Record<string, unknown>[]
  keyFields: string[]
}

export type DataQueryPayload = {
  runId: string
  taskName: string
  taskVersion: string
  attemptNo: number
  dataset: string
  fields: string[]
  filters: Record<string, unknown>
  limit: number
}

export type UpsertFn = (payload: DataUpsertPayload) => Promise<void> | void
export type QueryFn = (payload: DataQueryPayload) => Promise<Record<string, unknown>[]> | Record<string, unknown>[]
export type CapabilityProvider = (name: string) => unknown

export interface TaskContext {
  emit(schema: string, record: Record<string, unknown>): void
  checkpoint(data: Record<string, unknown>): void
  log(level: string, msg: string, fields?: Record<string, unknown>): void
  metric(name: string, value: number, tags?: Record<string, string>): void
  capability(name: string): unknown
  cap(): (name: string) => unknown
  cap(name: string): unknown
  upsert(dataset: string, rows: Record<string, unknown>[], keyFields: string[]): Promise<void>
  query(
    dataset: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
  ): Promise<Record<string, unknown>[]>
}

type CollectorContextOptions = {
  runId: string
  taskName: string
  taskVersion: string
  attemptNo?: number
  eventSink?: (event: TaskEvent) => void
  upsertFn?: UpsertFn
  queryFn?: QueryFn
  capabilityProvider?: CapabilityProvider
}

const noopEventSink = (_event: TaskEvent): void => {
  return
}

const noopUpsert: UpsertFn = async (_payload) => {
  return
}

const noopQuery: QueryFn = async (_payload) => {
  return []
}

const noopCapability: CapabilityProvider = (_name) => undefined

export class CollectorContext implements TaskContext {
  private readonly runId: string
  private readonly taskName: string
  private readonly taskVersion: string
  private readonly attemptNo: number
  private readonly eventSink: (event: TaskEvent) => void
  private readonly upsertSink: UpsertFn
  private readonly querySink: QueryFn
  private readonly capabilitySink: CapabilityProvider
  private seq = 0

  constructor(options: CollectorContextOptions) {
    this.runId = options.runId
    this.taskName = options.taskName
    this.taskVersion = options.taskVersion
    this.attemptNo = options.attemptNo ?? 1
    this.eventSink = options.eventSink ?? noopEventSink
    this.upsertSink = options.upsertFn ?? noopUpsert
    this.querySink = options.queryFn ?? noopQuery
    this.capabilitySink = options.capabilityProvider ?? noopCapability
  }

  emit(schema: string, record: Record<string, unknown>): void {
    this.pushEvent("record", { schema, record })
  }

  checkpoint(data: Record<string, unknown>): void {
    this.pushEvent("checkpoint", { data })
  }

  log(level: string, msg: string, fields: Record<string, unknown> = {}): void {
    this.pushEvent("log", { level, msg, fields })
  }

  metric(name: string, value: number, tags: Record<string, string> = {}): void {
    this.pushEvent("metric", { name, value, tags })
  }

  capability(name: string): unknown {
    return this.capabilitySink(name)
  }

  cap(): (name: string) => unknown
  cap(name: string): unknown
  cap(name?: string): unknown {
    if (typeof name === "string") {
      return this.capability(name)
    }
    return this.capability.bind(this)
  }

  async upsert(dataset: string, rows: Record<string, unknown>[], keyFields: string[]): Promise<void> {
    await this.upsertSink({
      runId: this.runId,
      taskName: this.taskName,
      taskVersion: this.taskVersion,
      attemptNo: this.attemptNo,
      dataset,
      rows,
      keyFields,
    })
  }

  async query(
    dataset: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    return await this.querySink({
      runId: this.runId,
      taskName: this.taskName,
      taskVersion: this.taskVersion,
      attemptNo: this.attemptNo,
      dataset,
      fields,
      filters,
      limit,
    })
  }

  private pushEvent(eventType: TaskEventType, payload: Record<string, unknown>): void {
    this.seq += 1
    this.eventSink({
      runId: this.runId,
      taskName: this.taskName,
      taskVersion: this.taskVersion,
      attemptNo: this.attemptNo,
      seq: this.seq,
      eventType,
      payload,
    })
  }
}
