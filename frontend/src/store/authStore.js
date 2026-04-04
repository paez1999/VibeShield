import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  token:  localStorage.getItem('vs_token') || null,
  userId: localStorage.getItem('vs_userId') || null,
  orgId:  localStorage.getItem('vs_orgId') || null,

  setAuth: ({ token, userId, orgId }) => {
    localStorage.setItem('vs_token',  token)
    localStorage.setItem('vs_userId', userId)
    localStorage.setItem('vs_orgId',  orgId)
    set({ token, userId, orgId })
  },

  clearAuth: () => {
    localStorage.removeItem('vs_token')
    localStorage.removeItem('vs_userId')
    localStorage.removeItem('vs_orgId')
    set({ token: null, userId: null, orgId: null })
  },

  isAuthenticated: () => !!localStorage.getItem('vs_token'),
}))
