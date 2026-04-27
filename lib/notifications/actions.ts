'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'

export async function markNotificationReadAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.userId)
    .is('read_at', null)
  if (error) return { error: error.message }
  revalidatePath('/notifications')
  revalidatePath('/me/notifications')
  return { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const admin = createAdminClient()
  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.userId)
    .is('read_at', null)
  if (error) return { error: error.message }
  revalidatePath('/notifications')
  revalidatePath('/me/notifications')
  return { ok: true }
}

export async function dismissNotificationAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', session.userId)
  if (error) return { error: error.message }
  revalidatePath('/notifications')
  revalidatePath('/me/notifications')
  return { ok: true }
}
