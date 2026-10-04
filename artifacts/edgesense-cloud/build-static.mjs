import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactRoot = path.dirname(fileURLToPath(import.meta.url));
const staticSource = path.join(artifactRoot, "static");
const staticDestination = path.join(artifactRoot, "dist", "public", "static");

await mkdir(staticDestination, { recursive: true });
await cp(staticSource, staticDestination, { recursive: true, force: true });