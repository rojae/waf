'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { AuthContext, AuthContextType, AuthService, User } from '@/lib/auth'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const userData = await AuthService.getUser()
      setUser(userData)
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = () => {
    AuthService.login()
  }

  const logout = async () => {
    await AuthService.logout()
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}