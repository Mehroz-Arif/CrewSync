import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File,
} from "lucide-react";

type FileCategory = "pdf" | "image" | "spreadsheet" | "video" | "audio" | "archive" | "code" | "document" | "other";

const EXTENSION_MAP: Record<string, FileCategory> = {
  pdf: "pdf",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", svg: "image", bmp: "image",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet",
  mp4: "video", mov: "video", avi: "video", webm: "video", mkv: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  js: "code", ts: "code", jsx: "code", tsx: "code", html: "code", css: "code", json: "code", py: "code",
  doc: "document", docx: "document", txt: "document", rtf: "document", md: "document",
};

export function getFileCategory(fileType: string): FileCategory {
  // Try by MIME type first
  if (fileType.startsWith("image/")) return "image";
  if (fileType.startsWith("video/")) return "video";
  if (fileType.startsWith("audio/")) return "audio";
  if (fileType === "application/pdf") return "pdf";

  // Try by extension
  const ext = fileType.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "other";
}

export function getCategoryFromName(fileName: string): FileCategory {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "other";
}

const CATEGORY_CONFIG: Record<FileCategory, { icon: typeof FileText; color: string; bg: string }> = {
  pdf: { icon: FileText, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  image: { icon: FileImage, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  spreadsheet: { icon: FileSpreadsheet, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  video: { icon: FileVideo, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  audio: { icon: FileAudio, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  archive: { icon: FileArchive, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  code: { icon: FileCode, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-900/30" },
  document: { icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  other: { icon: File, color: "text-muted-foreground", bg: "bg-muted" },
};

export function getFileConfig(fileType: string) {
  const category = getFileCategory(fileType);
  return CATEGORY_CONFIG[category];
}

export function getFileConfigFromName(fileName: string) {
  const category = getCategoryFromName(fileName);
  return CATEGORY_CONFIG[category];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
