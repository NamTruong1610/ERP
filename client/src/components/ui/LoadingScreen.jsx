// Shown while the session check is in progress. Prevents a flash redirect
// to /login before we know whether the user is logged in.
export default function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-page)',
      color: 'var(--text-hint)',
      fontSize: '14px'
    }}>
      Loading...
    </div>
  )
}