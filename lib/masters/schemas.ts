import { z } from 'zod'

const codeStr = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} code is required`)
    .regex(/^[A-Z0-9_-]+$/i, 'Letters, digits, - and _ only')

const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  )

const boolField = () =>
  z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())

export const DepartmentSchema = z.object({
  id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  code: codeStr('Department'),
  name: z.string().trim().min(1, 'Name is required'),
  is_active: boolField(),
})

export type DepartmentInput = z.infer<typeof DepartmentSchema>

export const DesignationSchema = z.object({
  id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  code: codeStr('Designation'),
  name: z.string().trim().min(1, 'Name is required'),
  grade: optStr(),
  is_active: boolField(),
})

export type DesignationInput = z.infer<typeof DesignationSchema>

export const ProjectSchema = z.object({
  id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  code: codeStr('Project'),
  name: z.string().trim().min(1, 'Name is required'),
  client: optStr(),
  is_active: boolField(),
})

export type ProjectInput = z.infer<typeof ProjectSchema>

export type MasterFormErrors<T extends object> = Partial<Record<keyof T | '_form', string[]>>
export type MasterFormResult<T extends object> = { errors?: MasterFormErrors<T>; ok?: boolean }
export type DepartmentState = MasterFormResult<DepartmentInput> | undefined
export type DesignationState = MasterFormResult<DesignationInput> | undefined
export type ProjectState = MasterFormResult<ProjectInput> | undefined
