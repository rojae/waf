'use client'

import { useAuth } from "@/lib/auth"
import { 
  Box, 
  Card, 
  CardContent, 
  Button, 
  Typography, 
  Avatar, 
  Chip, 
  Grid, 
  Container,
  Paper,
  Stack,
  Divider,
  useTheme,
  alpha
} from '@mui/material'
import { 
  Security, 
  Analytics, 
  Visibility, 
  Public, 
  Google as GoogleIcon,
  ShieldOutlined,
  LockOutlined,
  StorageOutlined
} from '@mui/icons-material'
import { keyframes } from '@mui/system'

// Floating animation
const float = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
  100% { transform: translateY(0px) rotate(360deg); }
`

const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0.7; }
`

export default function SignIn() {
  const { login } = useAuth()
  const theme = useTheme()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #334155 50%, #475569 75%, #64748b 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Floating Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          animation: `${float} 6s ease-in-out infinite`,
          animationDelay: '0s',
        }}
      >
        <Security sx={{ fontSize: 40, color: alpha('#3b82f6', 0.3) }} />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          right: '15%',
          animation: `${float} 8s ease-in-out infinite`,
          animationDelay: '2s',
        }}
      >
        <LockOutlined sx={{ fontSize: 32, color: alpha('#6366f1', 0.3) }} />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          left: '15%',
          animation: `${float} 10s ease-in-out infinite`,
          animationDelay: '4s',
        }}
      >
        <StorageOutlined sx={{ fontSize: 36, color: alpha('#8b5cf6', 0.3) }} />
      </Box>

      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha('#ffffff', 0.2)}`,
            borderRadius: 4,
            p: { xs: 3, sm: 4 },
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradient overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #06b6d4)',
            }}
          />

          <Stack spacing={4}>
            {/* Logo Section */}
            <Box>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 2,
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  animation: `${pulse} 3s ease-in-out infinite`,
                }}
              >
                <ShieldOutlined sx={{ fontSize: 40 }} />
              </Avatar>
              
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #ffffff, #e2e8f0)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  mb: 1,
                }}
              >
                WAF Dashboard
              </Typography>
              
              <Typography
                variant="h6"
                sx={{
                  color: alpha('#ffffff', 0.8),
                  fontWeight: 300,
                }}
              >
                Enterprise Web Application Firewall
              </Typography>
            </Box>

            {/* Features Grid */}
            <Grid container spacing={2}>
              {[
                // { icon: <Security />, label: 'Real-time Protection', color: '#3b82f6' },
                // { icon: <Analytics />, label: 'Advanced Analytics', color: '#6366f1' },
                // { icon: <Visibility />, label: 'Monitoring', color: '#06b6d4' },
                // { icon: <Public />, label: 'Global Security', color: '#8b5cf6' },
              ].map((item, index) => (
                <Grid item xs={6} key={index}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      background: alpha('#ffffff', 0.05),
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${alpha('#ffffff', 0.1)}`,
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: alpha('#ffffff', 0.08),
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <Box sx={{ color: item.color, mb: 1 }}>
                      {item.icon}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha('#ffffff', 0.7),
                        fontWeight: 500,
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Login Button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<GoogleIcon />}
              onClick={login}
              sx={{
                py: 2,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335)',
                backgroundSize: '400% 400%',
                animation: 'gradient 15s ease infinite',
                border: 'none',
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: '0 8px 32px rgba(66, 133, 244, 0.3)',
                transition: 'all 0.3s ease',
                '@keyframes gradient': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(66, 133, 244, 0.4)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              Continue with Google
            </Button>

            <Divider sx={{ borderColor: alpha('#ffffff', 0.1) }} />

            {/* Security Features */}
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
              {['OWASP Rules', 'Enterprise Auth', 'Real-time'].map((feature) => (
                <Chip
                  key={feature}
                  label={feature}
                  size="small"
                  sx={{
                    background: alpha('#ffffff', 0.1),
                    color: alpha('#ffffff', 0.8),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha('#ffffff', 0.2)}`,
                    '&:hover': {
                      background: alpha('#ffffff', 0.15),
                    },
                  }}
                />
              ))}
            </Stack>

            {/* Footer Text */}
            <Typography
              variant="body2"
              sx={{
                color: alpha('#ffffff', 0.6),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              🔒 Secured with enterprise-grade authentication
            </Typography>
          </Stack>
        </Paper>

        {/* Bottom Info */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography
            variant="body2"
            sx={{ color: alpha('#ffffff', 0.6), mb: 1 }}
          >
            Protected by OWASP ModSecurity Rules
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            alignItems="center"
            flexWrap="wrap"
          >
            {['Real-time Monitoring', 'Advanced Analytics', 'Enterprise Security'].map(
              (item, index, arr) => (
                <Box key={item} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: alpha('#ffffff', 0.5) }}
                  >
                    {item}
                  </Typography>
                  {index < arr.length - 1 && (
                    <Typography
                      variant="caption"
                      sx={{ color: alpha('#ffffff', 0.3), mx: 1 }}
                    >
                      •
                    </Typography>
                  )}
                </Box>
              )
            )}
          </Stack>
        </Box>
      </Container>
    </Box>
  )
}