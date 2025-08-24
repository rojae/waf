export interface User {
  id: string
  name: string
  email: string
  picture?: string
}

export interface Session {
  user: User
  expires: string
}