import { useEffect, useState } from 'react'

type BackendStatus = 'checking' | 'ok' | 'offline'

function App() {
  const [backend, setBackend] = useState<BackendStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/health', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: { ok?: boolean }) => setBackend(data.ok ? 'ok' : 'offline'))
      .catch(() => {
        if (!controller.signal.aborted) setBackend('offline')
      })

    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>Cram Cartridge</h1>
      <p>backend: {backend}</p>
    </main>
  )
}

export default App
