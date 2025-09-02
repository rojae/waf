/**
 * Error handling utilities
 */
import { HTTP_STATUS } from '@/lib/constants'

export interface ApiError {
  message: string
  status: number
  code?: string
}

export class ApiErrorHandler {
  static isConnectionError(error: Error): boolean {
    return 'code' in error && error.code === 'ECONNREFUSED'
  }

  static getStatusFromError(error: Error): number {
    if (this.isConnectionError(error)) {
      return HTTP_STATUS.SERVICE_UNAVAILABLE
    }
    return HTTP_STATUS.INTERNAL_SERVER_ERROR
  }

  static getMessageFromError(error: Error, defaultMessage: string): string {
    if (this.isConnectionError(error)) {
      return 'Service unavailable'
    }
    return defaultMessage
  }

  static createErrorResponse(error: Error, defaultMessage: string) {
    const status = this.getStatusFromError(error)
    const message = this.getMessageFromError(error, defaultMessage)
    
    return {
      error: message,
      status
    }
  }
}