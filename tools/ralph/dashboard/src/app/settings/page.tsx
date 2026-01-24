'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor, ArrowRight, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [graphDirection, setGraphDirection] = useState<'horizontal' | 'vertical'>('horizontal')

  useEffect(() => {
    setMounted(true)
    // Load graph direction from settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.graphDirection) {
          setGraphDirection(data.graphDirection)
        }
      })
      .catch(console.error)
  }, [])

  const saveTheme = async (newTheme: string) => {
    setTheme(newTheme)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      })
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }

  const saveGraphDirection = async (direction: 'horizontal' | 'vertical') => {
    setGraphDirection(direction)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphDirection: direction }),
      })
    } catch (error) {
      console.error('Failed to save graph direction:', error)
    }
  }

  if (!mounted) {
    return null
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const directions = [
    { value: 'horizontal', label: 'Horizontal', icon: ArrowRight },
    { value: 'vertical', label: 'Vertical', icon: ArrowDown },
  ]

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize how the dashboard looks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-3 block">Theme</label>
              <div className="flex gap-2">
                {themes.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-2',
                      theme === value && 'bg-primary'
                    )}
                    onClick={() => saveTheme(value)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Graph</CardTitle>
          <CardDescription>
            Customize the dependency graph layout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-3 block">Direction</label>
              <div className="flex gap-2">
                {directions.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={graphDirection === value ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-2',
                      graphDirection === value && 'bg-primary'
                    )}
                    onClick={() => saveGraphDirection(value as 'horizontal' | 'vertical')}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
