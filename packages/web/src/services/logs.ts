import { createApi, fetchBaseQuery } from '@tanstack/react-query'

export const logsApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  tagTypes: ['Logs'],
  endpoints: (builder) => ({
    getLogs: builder.query<LogEntry[], void>({
      query: () => '/logs',
      providesTags: ['Logs'],
    }),
    getLogLevels: builder.query<string[], void>({
      query: () => '/logs/levels',
    }),
  }),
})

export interface LogEntry {
  timestamp: string
  level: string
  module: string
  message: string
  data?: any
}

export const { useGetLogsQuery, useGetLogLevelsQuery } = logsApi

// Re-export the API for use in the component
export default logsApi