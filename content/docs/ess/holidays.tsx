import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'holidays',
  title: 'Holidays',
  summary: 'Why your holiday list might differ from a colleague&apos;s — and how to read /me/holidays.',
  group: 'Time off',
}

export default function Article() {
  return (
    <>
      <h2>Project-scoped calendars</h2>
      <p>
        Holidays in PayFlow are tied to your <strong>primary project</strong>. Two engineers in the same
        team but on different projects can have different holiday lists — for example, a US-client project
        may observe US federal holidays in addition to Indian public holidays.
      </p>
      <p>
        The page <code>/me/holidays</code> shows the calendar that applies to <em>you</em>: the union of
        company-wide holidays, your location&apos;s holidays, and your primary project&apos;s holidays.
      </p>

      <h2>Holiday types</h2>
      <ul>
        <li><strong>Public</strong> — closed for everyone.</li>
        <li><strong>Restricted</strong> — optional. Take it or substitute another day; check with your manager.</li>
        <li><strong>Optional</strong> — at your discretion (some orgs use this for festival flex days).</li>
      </ul>

      <h2>Effect on leave</h2>
      <p>
        When you apply for leave through <code>/me/leave/new</code>, the form skips holidays in your
        range automatically — they don&apos;t count against your balance. So if you take Apr 13–17 and Apr 14
        is your project&apos;s Tamil New Year holiday, only 4 days are deducted.
      </p>

      <h2>If your holidays look wrong</h2>
      <p>Two things can cause this:</p>
      <ol>
        <li>Your <strong>primary project</strong> is set incorrectly on your profile. HR can fix this.</li>
        <li>The holiday isn&apos;t configured for your project yet. Ask HR to add it.</li>
      </ol>
    </>
  )
}
