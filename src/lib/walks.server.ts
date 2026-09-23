import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface WalkPhoto {
  src: string;
  thumbnailSrc: string;
  by: string | null;
  marker: [number, number] | null;
  color: string | null;
}

export interface Walk {
  id: string;
  date: string;
  startedAt: number;
  duration: string;
  thumbnailPath: string;
  path: string;
  photos: WalkPhoto[];
}

interface WalkData {
  date: string;
  thumbnailPath: string;
  path: string;
  timeline: Array<[timeSeconds: number, x: number, y: number]>;
  photoPrompts?: Record<string, { type: string; value: string }>;
  photos: Array<{ file: string; timeSeconds?: number; by?: string }>;
}

const walksRoot = join(process.cwd(), "public", "routes");
const promptColors: Record<string, string> = {
  "light green": "#a8d67b",
  "dark green": "#315f43",
  yellow: "#f0cf3e",
  red: "#dc5149",
  black: "#202020",
  white: "#fff",
  silver: "#b7bcc0",
  blue: "#4778d0",
};

function markerAtTime(timeline: WalkData["timeline"], timeSeconds?: number): [number, number] | null {
  if (timeSeconds === undefined || !Number.isFinite(timeSeconds)) return null;
  let nearest: [number, number] | null = null;
  let distance = 60;
  for (const [at, x, y] of timeline) {
    const delta = Math.abs(at - timeSeconds);
    if (delta < distance) { nearest = [x, y]; distance = delta; }
  }
  return nearest;
}

export async function loadWalks(): Promise<Walk[]> {
  const files = (existsSync(walksRoot) ? await readdir(walksRoot) : []).filter((file) => /^[a-f0-9]{16}\.json$/.test(file));
  const walks = await Promise.all(files.map(async (file) => {
    const id = file.slice(0, -5);
    const data = JSON.parse(await readFile(join(walksRoot, file), "utf8")) as WalkData;
    if (!data.path || !data.thumbnailPath || !data.timeline.length) throw new Error(`Invalid walk: ${id}`);
    const minutes = Math.round((data.timeline.at(-1)![0] - data.timeline[0][0]) / 60);
    const duration = `${minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ""}${minutes % 60}m`;
    const photos = data.photos.filter((photo) => existsSync(join(process.cwd(), "public", "walks", id, "photos", photo.file))).sort((a, b) => (a.timeSeconds ?? Infinity) - (b.timeSeconds ?? Infinity)).map((photo): WalkPhoto => {
      const src = `/walks/${id}/photos/${encodeURIComponent(photo.file)}`;
      const thumbnailSrc = `/walks/${id}/thumbs/${encodeURIComponent(photo.file)}`;
      const prompt = photo.by ? data.photoPrompts?.[photo.by] : null;
      return {
        src,
        thumbnailSrc: existsSync(join(process.cwd(), "public", "walks", id, "thumbs", photo.file)) ? thumbnailSrc : src,
        by: photo.by ?? null,
        marker: markerAtTime(data.timeline, photo.timeSeconds),
        color: prompt?.type === "color" ? promptColors[prompt.value] ?? null : null,
      };
    });
    return { id, date: data.date, startedAt: data.timeline[0][0], duration, thumbnailPath: data.thumbnailPath, path: data.path, photos };
  }));
  return walks.sort((a, b) => b.startedAt - a.startedAt);
}
