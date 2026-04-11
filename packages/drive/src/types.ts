export type DriveFile = {
  content: Buffer
  mimeType: string | null
  size: number
}

export interface DriveService {
  put(key: string, data: Buffer, mimeType?: string): Promise<void>
  get(key: string): Promise<DriveFile>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  getUrl(key: string): Promise<string>
}
