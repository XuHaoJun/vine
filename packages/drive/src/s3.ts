import { Disk } from 'flydrive'
import { S3Driver } from 'flydrive/drivers/s3'
import type { DriveService } from './types'
import { createDriveService } from './disk'

type S3Deps = {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  cdnUrl?: string
}

export function createS3DriveService(deps: S3Deps): DriveService {
  const driver = new S3Driver({
    bucket: deps.bucket,
    region: deps.region,
    credentials: {
      accessKeyId: deps.accessKeyId,
      secretAccessKey: deps.secretAccessKey,
    },
    endpoint: deps.endpoint,
    cdnUrl: deps.cdnUrl,
    visibility: 'public',
  })
  const disk = new Disk(driver)
  return createDriveService(disk)
}
