import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('galaxy_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
      return Promise.reject(error)
    }
    return Promise.reject(error?.response?.data || error)
  }
)

export default api
