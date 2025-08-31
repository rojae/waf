import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useAuthGuard() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  return { user, loading, isAuthenticated: !!user }
}