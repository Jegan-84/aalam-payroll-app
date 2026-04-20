import { z } from 'zod'

const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  )

const roleArray = () =>
  z.preprocess(
    // FormData serializes repeated fields as an array via getAll; handle both shapes.
    (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]),
    z.array(z.string()).default([]),
  )

export const CreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email required.'),
  full_name: z.string().trim().min(1, 'Name is required.'),
  password: z.string().min(8, 'At least 8 characters.'),
  roles: roleArray(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>

export const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1, 'Name is required.'),
  is_active: z.preprocess(
    (v) => v === 'on' || v === 'true' || v === true,
    z.boolean(),
  ),
  roles: roleArray(),
})

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

export const ResetPasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8, 'At least 8 characters.'),
})

export type UserFormErrors<T extends object> = Partial<Record<keyof T | '_form', string[]>>

export type UserFormResult<T extends object> = {
  errors?: UserFormErrors<T>
  ok?: boolean
  id?: string
}

export type CreateUserState = UserFormResult<CreateUserInput> | undefined
export type UpdateUserState = UserFormResult<UpdateUserInput> | undefined

// Convenience type for forms that update password only
export type ResetPasswordState = UserFormResult<{ password: string }> | undefined

// Keep in sync with seeded roles in seed.sql
export type RoleCode = 'admin' | 'hr' | 'payroll' | 'employee'

/**
 * Return the intersection of current roles and `desired` plus the new ones.
 * Used by update action to compute diffs.
 */
export function computeRoleDiff(current: string[], desired: string[]): { toAdd: string[]; toRemove: string[] } {
  const cur = new Set(current)
  const des = new Set(desired)
  const toAdd = desired.filter((r) => !cur.has(r))
  const toRemove = current.filter((r) => !des.has(r))
  return { toAdd, toRemove }
}

export const optStrExport = optStr   // to avoid unused-import noise
