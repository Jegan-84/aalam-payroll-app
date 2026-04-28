declare module 'node-zklib' {
  type AttendanceRow = {
    userSn?: number
    deviceUserId: string | number
    recordTime: Date | string
    ip?: string
  }

  type DeviceInfo = {
    serialNumber?: string
    userCounts?: number
    logCounts?: number
    logCapacity?: number
  }

  class ZKLib {
    constructor(ip: string, port?: number, timeout?: number, inport?: number)
    createSocket(): Promise<void>
    disconnect(): Promise<void>
    getInfo(): Promise<DeviceInfo>
    getAttendances(): Promise<{ data: AttendanceRow[] }>
    getUsers(): Promise<{ data: Array<{ uid: number; userid: string | number; name: string; cardno?: number }> }>
    clearAttendanceLog(): Promise<void>
    enableDevice(): Promise<void>
    disableDevice(): Promise<void>
  }

  export = ZKLib
}
