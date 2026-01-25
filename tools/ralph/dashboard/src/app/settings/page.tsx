'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [versions, setVersions] = useState<string[]>([])
  const [defaultVersion, setDefaultVersion] = useState<string>('first')

  useEffect(() => {
    setMounted(true)
    // Fetch available versions and settings together
    Promise.all([
      fetch('/api/versions').then(res => res.json()),
      fetch('/api/settings').then(res => res.json())
    ]).then(([versionData, settingsData]) => {
      const availableVersions = versionData.versions || []
      setVersions(availableVersions)

      // Resolve 'first' or invalid version to actual first version
      const savedVersion = settingsData.defaultVersion
      if (savedVersion && savedVersion !== 'first' && availableVersions.includes(savedVersion)) {
        setDefaultVersion(savedVersion)
      } else if (availableVersions.length > 0) {
        setDefaultVersion(availableVersions[0])
      }
    }).catch(() => {})
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

  const saveDefaultVersion = async (version: string) => {
    setDefaultVersion(version)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultVersion: version }),
      })
    } catch (error) {
      console.error('Failed to save default version:', error)
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
          <CardTitle>Stories</CardTitle>
          <CardDescription>
            Configure the default view for the Stories page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-3 block">Default Version</label>
              <Select value={defaultVersion} onValueChange={saveDefaultVersion}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map(version => (
                    <SelectItem key={version} value={version}>
                      {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                The version shown when you open the Stories page
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
