import { createContext, useContext } from 'react'

export interface User {
  id: string
  email: string
  name: string
  provider: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export class AuthService {
  static async getUser(): Promise<User | null> {
    try {
      const response = await fetch('/api/session/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('Failed to get user:', error)
      return null
    }
  }

  static login() {
    // Redirect to our backend login endpoint which will handle OAuth properly
    window.location.href = '/auth/google/login?redirect_uri=' + encodeURIComponent(window.location.origin + '/dashboard')
  }

  static async logout(): Promise<void> {
    try {
      await fetch('/api/session/logout', {
        method: 'POST',
        credentials: 'include',
      })
      // Redirect to home page after logout
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
      // Force redirect even if logout request fails
      window.location.href = '/'
    }
  }
}