'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useUIStore } from '@/store/ui'

async function fetchCurrentUser() {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  const data = await res.json()
  return data.success ? data.data : null
}

export function useAuth() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const setUser = useUIStore((s) => s.setUser)

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Login failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setUser(data.data.user)
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      router.push('/dashboard')
      toast.success('Welcome back!')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => fetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      setUser(null)
      queryClient.clear()
      router.push('/login')
      toast.success('Logged out successfully')
    },
  })

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  }
}
