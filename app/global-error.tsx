'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f4f4f5', color: '#18181b', minHeight: '100vh', margin: 0 }}>
        <div style={{ maxWidth: 560, margin: '64px auto', padding: 24, borderRadius: 12, background: '#fff', border: '1px solid #e4e4e7' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: '#52525b' }}>
            A fatal error happened before the app could render. This is usually a configuration issue (missing env vars, DB unreachable).
          </p>
          {error.digest && (
            <p style={{ marginTop: 6, fontSize: 12, color: '#71717a' }}>Error id: {error.digest}</p>
          )}
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#71717a' }}>Technical details</summary>
            <pre style={{ marginTop: 8, padding: 12, background: '#f4f4f5', borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
{error.message}
            </pre>
          </details>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={reset}
              style={{ height: 36, padding: '0 16px', borderRadius: 6, background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{ height: 36, padding: '0 16px', borderRadius: 6, background: '#fff', color: '#18181b', border: '1px solid #d4d4d8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 14 }}
            >
              Sign in again
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
