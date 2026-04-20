-- =============================================================================
-- Performance indexes — composite indexes for the hottest query shapes
-- =============================================================================
-- Each index below is added because a query in the app filters on the same
-- column combination and today the planner has to intersect two single-column
-- indexes (BitmapAnd) or do a range scan + filter. Composite indexes let the
-- planner do a single seek.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- salary_structures — "active structure for employee" lookup
-- -----------------------------------------------------------------------------
-- Hit by: getEmployeeActiveCtc(), saveVpAllocationAction(), payroll compute.
-- Existing index idx_sal_emp_active is ordered by effective_from DESC which
-- suits "history" queries, not "give me the current row for this employee".
-- A partial index on WHERE effective_to IS NULL AND status = 'active' collapses
-- the lookup to one row per employee.
create index if not exists idx_sal_current_by_emp
  on public.salary_structures(employee_id)
  where effective_to is null and status = 'active';

-- -----------------------------------------------------------------------------
-- leave_applications — per-employee filtered by status
-- -----------------------------------------------------------------------------
-- Hit by: listLeaveApplications({ status }), employee leave history page.
-- Separate indexes on employee_id and status exist; composite is more
-- selective (an employee has few leaves; a status has many).
create index if not exists idx_la_emp_status
  on public.leave_applications(employee_id, status);

-- -----------------------------------------------------------------------------
-- payroll_item_components — ordered fetch for a payslip
-- -----------------------------------------------------------------------------
-- Hit by: getCycleItem() → selects components and orders by display_order.
-- With only (item_id) indexed, Postgres must sort after the filter. Composite
-- pushes the ORDER BY into the index scan.
create index if not exists idx_pic_item_order
  on public.payroll_item_components(item_id, display_order);

-- -----------------------------------------------------------------------------
-- audit_log — recent activity by entity / actor
-- -----------------------------------------------------------------------------
-- Used when inspecting the trail for a cycle or employee. Orders by occurred_at
-- DESC over filtered rows; a composite (entity_id, occurred_at DESC) index lets
-- the detail pages stream recent events without scanning.
create index if not exists idx_audit_entity_recent
  on public.audit_log(entity_type, entity_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- employee_pay_components — active recurring lines for an employee
-- -----------------------------------------------------------------------------
-- Hit by: payroll compute (recurringByEmp pre-fetch) and per-employee pages.
-- The existing partial index covers (employee_id, effective_from, effective_to)
-- WHERE is_active; this supplemental non-partial composite helps the inactive
-- history reads on the employee's Recurring Components tab.
create index if not exists idx_epc_emp_code
  on public.employee_pay_components(employee_id, code);
