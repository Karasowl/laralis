'use client'

import { useEffect, useState } from 'react'

export default function TestPlatforms() {
  const [platforms, setPlatforms] = useState<any[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlatforms() {
      try {
        console.log('Fetching platforms...')
        const response = await fetch('/api/marketing/platforms', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          const errorData = await response.text()
          console.error('Error response:', errorData)
          setError(`Error ${response.status}: ${errorData}`)
          return
        }
        
        const data = await response.json()
        console.log('Platforms data:', data)
        setPlatforms(data.data || [])
      } catch (err) {
        console.error('Fetch error:', err)
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchPlatforms()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Marketing Platforms</h1>
      
      {loading && <p>Loading...</p>}
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="mb-4">
        <strong>Total platforms:</strong> {platforms.length}
      </div>
      
      {platforms.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Platforms:</h2>
          <ul className="list-disc pl-5">
            {platforms.map((p: any) => (
              <li key={p.id}>
                {p.display_name || p.name} (ID: {p.id})
                {p.is_system && ' [System]'}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <p className="text-sm">Check browser console for detailed logs</p>
      </div>
    </div>
  )
}