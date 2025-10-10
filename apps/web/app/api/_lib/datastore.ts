import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { dbPath, storageRoot } from "@/app/api/_lib/paths";

interface TableMap {
  [table: string]: Record<string, unknown>;
}

let cache: TableMap | null = null;
let pendingWrite: Promise<void> | null = null;

async function ensureBaseDir() {
  await mkdir(path.dirname(dbPath), { recursive: true });
}

async function load(): Promise<TableMap> {
  if (cache) {
    return cache;
  }
  await ensureBaseDir();
  try {
    const raw = await readFile(dbPath, "utf-8");
    cache = JSON.parse(raw) as TableMap;
  } catch (error) {
    cache = {};
  }
  return cache!;
}

async function persist(data: TableMap) {
  await ensureBaseDir();
  const serialized = JSON.stringify(data, null, 2);
  const tempPath = `${dbPath}.tmp`;
  await writeFile(tempPath, serialized, "utf-8");
  await rename(tempPath, dbPath);
  cache = data;
}

function ensureTable(map: TableMap, table: string) {
  if (!map[table]) {
    map[table] = {};
  }
}

export async function upsertRecord<T extends { id: string }>(table: string, record: T): Promise<T> {
  const data = await load();
  ensureTable(data, table);
  data[table]![record.id] = record;
  pendingWrite = persist(data);
  await pendingWrite;
  return record;
}

export async function removeRecord(table: string, id: string): Promise<void> {
  const data = await load();
  if (!data[table] || !data[table]![id]) {
    return;
  }
  delete data[table]![id];
  pendingWrite = persist(data);
  await pendingWrite;
}

export async function getRecord<T>(table: string, id: string): Promise<T | null> {
  const data = await load();
  const tableData = data[table];
  if (!tableData) {
    return null;
  }
  return (tableData[id] as T | undefined) ?? null;
}

export async function listRecords<T>(table: string): Promise<T[]> {
  const data = await load();
  const tableData = data[table];
  if (!tableData) {
    return [];
  }
  return Object.values(tableData) as T[];
}

export async function resetTable(table: string) {
  const data = await load();
  data[table] = {};
  pendingWrite = persist(data);
  await pendingWrite;
}

export async function getStorageRoot() {
  await ensureBaseDir();
  return storageRoot;
}
