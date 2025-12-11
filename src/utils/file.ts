import { nanoid } from 'nanoid';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { fileHashes } from '../db/schema/fileHashes.js';

const removeFileExtensionRegex = /\.[^/.]+$/;

export const fileNameSanitizerRegex = /[^a-zA-Z0-9._-]/g;

export const createFileName = (fileName: string) => {
  const fileNameWithoutExtension = fileName.replace(removeFileExtensionRegex, '');
  return `${fileNameWithoutExtension.replace(fileNameSanitizerRegex, '_')}-${nanoid(16)}.pdf`;
};

/**
 * @returns The filename of the duplicate file if it exists, otherwise null
 */
export async function isFileDuplicate(buffer: Buffer) {
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const [existingFile] = await db.select().from(fileHashes).where(eq(fileHashes.hash, fileHash));
  return existingFile ? existingFile.name : null;
}

export async function saveFile(buffer: Buffer, name: string) {
  const fileHash = createHash('sha256').update(buffer).digest('hex');

  const duplicateFileName = await isFileDuplicate(buffer);

  if (duplicateFileName) {
    return { fileName: duplicateFileName, duplicate: true };
  }

  const fileName = createFileName(name);
  const filePath = path.join(process.cwd(), 'files', fileName);

  await writeFile(filePath, buffer);

  await db.insert(fileHashes).values({
    name: fileName,
    hash: fileHash,
  });

  return { fileName, duplicate: false };
}

export class FilenameValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'FilenameValidationError';
  }
}

export function validateAndSanitizeFilename(
  filename: string | undefined,
  filesDir?: string,
): { sanitizedFilename: string; filePath: string; filesDir: string } {
  if (!filename || typeof filename !== 'string') {
    throw new FilenameValidationError('Invalid filename', 400);
  }

  filename = path.basename(filename);

  if (filename === '.' || filename === '..' || filename.length === 0) {
    throw new FilenameValidationError('Invalid filename', 400);
  }

  // sanitize filename
  const sanitizedFilename = filename.replace(fileNameSanitizerRegex, '_');

  // directory traversal prevention
  const resolvedFilesDir = filesDir || path.resolve(process.cwd(), 'files');
  const filePath = path.resolve(resolvedFilesDir, sanitizedFilename);

  if (!filePath.startsWith(resolvedFilesDir + path.sep) && filePath !== resolvedFilesDir) {
    throw new FilenameValidationError('Directory traversal attempt detected', 403);
  }

  return { sanitizedFilename, filePath, filesDir: resolvedFilesDir };
}
