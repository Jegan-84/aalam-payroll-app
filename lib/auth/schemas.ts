import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
})

export type LoginInput = z.infer<typeof LoginSchema>

export type LoginFormState = {
  errors?: {
    email?: string[]
    password?: string[]
    _form?: string[]
  }
} | undefined

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
})
export type ForgotPasswordFormState =
  | { errors?: { email?: string[]; _form?: string[] }; sent?: boolean }
  | undefined

export const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirm:  z.string().min(1, 'Confirm your password.'),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  })
export type ResetPasswordFormState =
  | { errors?: { password?: string[]; confirm?: string[]; _form?: string[] }; ok?: boolean }
  | undefined
