import type { Disk } from 'flydrive'
import type { DriveFile, DriveService } from './types'

export function createDriveService(disk: Disk): DriveService {
  return {
    async put(key, data, mimeType) {
      await disk.put(key, data, {
        contentType: mimeType,
      })
    },

    async get(key) {
      const bytes = await disk.getBytes(key)
      const meta = await disk.getMetaData(key).catch(() => null)
      return {
        content: Buffer.from(bytes),
        mimeType: meta?.contentType ?? null,
        size: meta?.contentLength ?? bytes.byteLength,
      }
    },

    async exists(key) {
      return await disk.exists(key)
    },

    async delete(key) {
      await disk.delete(key)
    },

    async getUrl(key) {
      return await disk.getUrl(key)
    },
  }
}
