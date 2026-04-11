import { Disk } from 'flydrive'
import { FSDriver } from 'flydrive/drivers/fs'
import type { DriveService } from './types'
import { createDriveService } from './disk'

type FsDeps = {
  basePath: string
  baseUrl: string
}

export function createFsDriveService(deps: FsDeps): DriveService {
  const driver = new FSDriver({
    location: deps.basePath,
    visibility: 'public',
    urlBuilder: {
      generateURL(key: string) {
        return Promise.resolve(`${deps.baseUrl.replace(/\/$/, '')}/${key}`)
      },
    },
  })
  const disk = new Disk(driver)
  return createDriveService(disk)
}
