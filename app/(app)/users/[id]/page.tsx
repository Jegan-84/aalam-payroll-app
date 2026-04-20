import Link from 'next/link'
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { getMfaStatus } from '@/lib/auth/mfa'
import { getUser, listAllRoles } from '@/lib/users/queries'
import { EditUserForm } from '../_components/edit-user-form'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'Edit user' }

type PP = Promise<{ id: string }>

export default async function EditUserPage({ params }: { params: PP }) {
  const { id } = await params
  const session = await verifySession()
  const [user, roles] = await Promise.all([getUser(id), listAllRoles()])
  if (!user) notFound()

  const isSelf = session.userId === user.id
  const mfa = isSelf ? await getMfaStatus() : null

  return (
    <div className="space-y-5">
      <div>
        <Link href="/users" className="text-sm text-slate-500 hover:underline">← Users</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {user.full_name ?? user.email}{' '}
          <span className="text-base font-normal text-slate-500">({user.email})</span>
        </h1>
      </div>

      {isSelf && mfa && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Two-step verification</h3>
                {mfa.hasVerifiedFactor ? <Badge tone="success">enabled</Badge> : <Badge tone="warn">not set</Badge>}
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {mfa.hasVerifiedFactor
                  ? 'You\u2019ll be asked for a 6-digit authenticator code every time you sign in.'
                  : 'Protect your account with an authenticator app (Google Authenticator, Authy, 1Password).'}
              </p>
            </div>
            <ButtonLink href="/mfa/setup" variant={mfa.hasVerifiedFactor ? 'outline' : 'primary'}>
              {mfa.hasVerifiedFactor ? 'Manage authenticators' : 'Set up 2FA'}
            </ButtonLink>
          </CardBody>
        </Card>
      )}

      <EditUserForm user={user} roles={roles} isSelf={isSelf} />
    </div>
  )
}
