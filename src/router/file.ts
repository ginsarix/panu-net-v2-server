import fs from 'node:fs/promises';
import { db } from '../db/index.js';
import { contracts } from '../db/schema/contracts.js';
import { eq, or } from 'drizzle-orm';
import mime from 'mime';
import type { FastifyInstance } from 'fastify';
import {
  saveFile,
  validateAndSanitizeFilename,
  FilenameValidationError,
  isFileDuplicate,
} from '../utils/file.js';
import { loginCheck } from '../utils/auth.js';
import { pdfToPng } from 'pdf-to-png-converter';
import sharp from 'sharp';
import path from 'node:path';
import { fileHashes } from '../db/schema/fileHashes.js';
import { createHash } from 'node:crypto';
import type { MultipartValue } from '@fastify/multipart';
import { directoryTraversalAttemptDetectedMessage } from '../constants/messages.js';

export default function (fastify: FastifyInstance) {
  fastify.post('/file/upload', async (req, res) => {
    try {
      const login = await loginCheck(req.session);

      if (login.role !== 'admin') {
        return res.status(403).send({ message: 'Bu işlemi yapma yetkiniz yok.' });
      }

      const file = await req.file();
      if (!file) {
        return res.status(400).send({ message: 'Dosya yüklenmedi.' });
      }

      const buffer = await file.toBuffer();
      if (buffer.length === 0) {
        return res.status(400).send({ message: 'Dosya verisi bulunamadı.' });
      }

      const fileName = file.filename;
      const fileSaveInfo = await saveFile(buffer, fileName);

      if (file.fields?.contractId) {
        const contractId = Number((file.fields.contractId as MultipartValue<string>).value);
        if (contractId) {
          const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
          if (!contract) {
            return res.status(404).send({ message: 'Sözleşme bulunamadı.' });
          }

          const contractsWithOldFileName = await db
            .select()
            .from(contracts)
            .where(eq(contracts.fileName, contract.fileName));
          const contractsWithOldFileNameExists = contractsWithOldFileName.length > 0;

          if (!contractsWithOldFileNameExists) {
            void fs.unlink(path.join(process.cwd(), 'files', contract.fileName));
            void fs.unlink(
              path.join(
                process.cwd(),
                'files',
                'thumbnails',
                contract.fileName.replace('.pdf', '.png'),
              ),
            );
            await db
              .delete(fileHashes)
              .where(
                or(
                  eq(fileHashes.name, contract.fileName),
                  eq(fileHashes.name, contract.fileName.replace('.pdf', '.png')),
                ),
              );
          }

          await db
            .update(contracts)
            .set({
              fileName: fileSaveInfo.fileName,
            })
            .where(eq(contracts.id, Number(contractId)));
        }
      }

      return res.status(201).send(fileSaveInfo);
    } catch (error) {
      req.log.error(error, 'Failed to upload file');
      return res.status(500).send({ message: 'Dosya yüklenirken bir hata oluştu.' });
    }
  });
  fastify.get('/file/:filename', async (req, res) => {
    const { filename: rawFilename } = req.params as { filename: string };

    try {
      const { sanitizedFilename, filePath } = validateAndSanitizeFilename(rawFilename);

      try {
        const file = await fs.readFile(filePath);
        const contentType = mime.getType(filePath) || 'application/octet-stream';

        const [contract] = await db
          .select()
          .from(contracts)
          .where(eq(contracts.fileName, sanitizedFilename));

        const sendFile = () =>
          res
            .header('Content-Type', contentType)
            .header('Content-Disposition', `inline; filename="${sanitizedFilename}"`)
            .send(file);

        if (!contract) {
          return sendFile();
        }

        const login = await loginCheck(req.session);

        if (login.role !== 'admin') {
          const selectedCompanyId = req.session.get('selectedCompanyId');
          if (selectedCompanyId !== contract.companyId) {
            return res.status(403).send('Bu dosyaya erişim yetkiniz yok.');
          }
        }

        return sendFile();
      } catch (error) {
        req.log.error(error, 'Failed to get file');

        if (error instanceof Error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return res.status(404).send('Dosya bulunamadı.');
          }
        }

        return res.status(500).send('Dosya getirilirken bir hata oluştu.');
      }
    } catch (error) {
      if (error instanceof FilenameValidationError) {
        if (error.statusCode === 403) {
          req.log.warn({ filename: rawFilename }, 'Directory traversal attempt detected');
          return res.status(403).send(directoryTraversalAttemptDetectedMessage);
        }
        return res.status(error.statusCode).send(error.message);
      }
      return res.status(500).send('Dosya getirilirken bir hata oluştu.');
    }
  });
  fastify.get('/file/thumbnail/:filename', async (req, res) => {
    const { filename: rawFilename } = req.params as { filename: string };

    try {
      const { sanitizedFilename } = validateAndSanitizeFilename(
        rawFilename,
        path.join(process.cwd(), 'files', 'thumbnails'),
      );

      const sendFile = (buffer: Buffer) =>
        res
          .header('Content-Type', 'image/png')
          .header('Content-Disposition', `inline; filename="${sanitizedFilename}"`)
          .send(buffer);

      let thumbnailBuffer: Buffer | undefined;
      try {
        thumbnailBuffer = await fs.readFile(
          path.join(process.cwd(), 'files', 'thumbnails', sanitizedFilename),
        );
      } catch {
        /* empty */
      }

      if (thumbnailBuffer) {
        const duplicateFileName = await isFileDuplicate(thumbnailBuffer);

        if (duplicateFileName) {
          return sendFile(thumbnailBuffer);
        }
      }

      const [pdfThumbnail] = await pdfToPng(
        path.join(process.cwd(), 'files', sanitizedFilename.replace('.png', '.pdf')),
        {
          viewportScale: 1.0,
          pagesToProcess: [1],
          outputFolder: undefined, // for just buffer
        },
      );

      const thumbnailProcess = sharp(pdfThumbnail.content)
        .resize(300, null, { withoutEnlargement: true }) // keep aspect ratio
        .png({ quality: 80, compressionLevel: 9, adaptiveFiltering: true });

      await thumbnailProcess.toFile(
        path.join(process.cwd(), 'files', 'thumbnails', sanitizedFilename.replace('.pdf', '.png')),
      );

      const processedThumbnailBuffer = await thumbnailProcess.toBuffer();

      const thumbnailHash = createHash('sha256').update(processedThumbnailBuffer).digest('hex');

      await db.insert(fileHashes).values({
        name: sanitizedFilename.replace('.pdf', '.png'),
        hash: thumbnailHash,
      });

      return sendFile(processedThumbnailBuffer);
    } catch (error) {
      req.log.error(error, 'Failed to get thumbnail');
      if (error instanceof FilenameValidationError) {
        if (error.statusCode === 403) {
          req.log.warn({ filename: rawFilename }, 'Directory traversal attempt detected');
          return res.status(403).send(directoryTraversalAttemptDetectedMessage);
        }
        return res.status(error.statusCode).send(error.message);
      }

      return res.status(500).send('Thumbnail getirilirken bir hata oluştu.');
    }
  });
}
