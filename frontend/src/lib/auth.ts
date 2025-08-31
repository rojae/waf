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
    // Redirect to backend OAuth login
    window.location.href = `${process.env.NEXT_PUBLIC_SOCIAL_API_URL || 'http://localhost:8081'}/auth/google/login?redirect_uri=${window.location.origin}`
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