import path from "path";

const projectRoot = path.resolve(process.cwd(), "..", "..");

export const storageRoot = process.env.BRATGEN_STORAGE ?? path.join(projectRoot, "storage");
export const uploadRoot = path.join(storageRoot, "uploads");
export const renderRoot = path.join(storageRoot, "renders");
export const dbPath = path.join(storageRoot, "metadata.json");
