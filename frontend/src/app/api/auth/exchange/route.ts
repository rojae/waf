import { HTTP_STATUS } from '@/lib/constants'

export async function POST() {
  return Response.json(
    { error: 'Use the validated /login/oauth2/code/google callback flow.' },
    { status: HTTP_STATUS.METHOD_NOT_ALLOWED },
  )
}
