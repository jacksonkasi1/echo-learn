// Axios client instance with base configuration
// All API calls should use this instance for consistent configuration

import axios from 'axios'
import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import { env } from '@/config/env'

// Create axios instance with default configuration
export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 90000, // 90 seconds timeout for long-running operations (OCR, embedding, graph generation)
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth headers, logging, etc.
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // You can add authorization headers here if needed
    // const token = localStorage.getItem('token')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }

    // Log requests in development
    if (env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`)
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  },
)

// Response interceptor for handling errors globally
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError<{ message?: string }>) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response

      switch (status) {
        case 401:
          console.error('[API Error] Unauthorized - Invalid credentials')
          break
        case 403:
          console.error('[API Error] Forbidden - Access denied')
          break
        case 404:
          console.error('[API Error] Not Found - Resource does not exist')
          break
        case 500:
          console.error(
            '[API Error] Server Error -',
            data.message ?? 'Internal server error',
          )
          break
        default:
          console.error(
            `[API Error] ${status} -`,
            data.message ?? 'Unknown error',
          )
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error(
        '[API Error] No response received - Network error or server is down',
      )
    } else {
      // Something happened in setting up the request
      console.error('[API Error] Request setup failed -', error.message)
    }

    return Promise.reject(error)
  },
)

// Export types for API responses
export interface ApiResponse<T> {
  data: T
  status: number
  statusText: string
}

export interface ApiError {
  error: string
  message?: string
  status?: number
}
