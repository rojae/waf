'use client'

import { useState, useEffect } from 'react'
import { CircularProgress, Box } from '@mui/material'

interface ChartWrapperProps {
  children: React.ReactNode
  loading?: boolean
}

export default function ChartWrapper({ children, loading = false }: ChartWrapperProps) {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  if (!isMounted || loading) {
    return (
      <Box sx={{ 
        height: 250, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <CircularProgress />
      </Box>
    )
  }
  
  return <>{children}</>
}