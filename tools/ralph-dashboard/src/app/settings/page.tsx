'use client'

import { useTheme } from 'next-themes'
import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Sun, Moon, Monitor, Zap, Clock, Loader2, Globe } from 'lucide-react'
import { useSettings, useUpdateSettings, useVersions } from '@/lib/query'

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const currentTheme = theme === 'system' ? 'system' : resolvedTheme
  const [userDashboardUrl, setUserDashboardUrl] = useState<string | null>(null)

  // TanStack Query hooks
  const { data: settings, isLoading: settingsLoading } = useSettings()
  const { data: versionsData, isLoading: versionsLoading } = useVersions()
  const updateSettings = useUpdateSettings()

  const versions = useMemo(() => versionsData?.versions || [], [versionsData?.versions])
  const loading = settingsLoading || versionsLoading

  // Derive dashboard URL - user input takes precedence over settings
  const dashboardUrlInput = userDashboardUrl ?? settings?.dashboardUrl ?? 'http://localhost:4000'

  const saveTheme = (newTheme: string) => {
    setTheme(newTheme)
    updateSettings.mutate({ theme: newTheme as any })
  }

  const saveDefaultVersion = (version: string) => {
    updateSettings.mutate({ defaultVersion: version })
  }

  const saveTimezone = (tz: string) => {
    updateSettings.mutate({ timezone: tz })
  }

  const saveDashboardUrl = () => {
    updateSettings.mutate({ dashboardUrl: dashboardUrlInput })
  }

  const timezones = [
    { value: 'Africa/Johannesburg', label: 'South Africa (UTC+2)' },
    { value: 'America/Costa_Rica', label: 'Costa Rica (UTC-6)' },
    { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
    { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
    { value: 'America/Denver', label: 'Denver (UTC-7/-6)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
    { value: 'Europe/London', label: 'London (UTC+0/+1)' },
    { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
    { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
    { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
    { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
    { value: 'UTC', label: 'UTC' },
  ]

  if (loading) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">Loading...</p>
      </div>
    )
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'cyber-light', label: 'Cyber Light', icon: Zap },
    { value: 'cyber-dark', label: 'Cyber Dark', icon: Zap },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-foreground">Settings</h1>

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
              <div className="flex flex-wrap gap-2">
                {themes.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="outline"
                    active={currentTheme === value}
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
              <Select value={versions.includes(settings?.defaultVersion || '') ? settings?.defaultVersion : versions[0] || ''} onValueChange={saveDefaultVersion} disabled={loading || updateSettings.isPending}>
                <SelectTrigger className="w-[200px]">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : updateSettings.isPending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select version" />
                  )}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timezone
          </CardTitle>
          <CardDescription>
            Timezone used for activity log timestamps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-3 block">Preferred Timezone</label>
              <Select value={settings?.timezone || 'Africa/Johannesburg'} onValueChange={saveTimezone} disabled={loading || updateSettings.isPending}>
                <SelectTrigger className="w-[280px]">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : updateSettings.isPending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select timezone" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {timezones.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                Claude will use this timezone when writing activity logs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Execution
          </CardTitle>
          <CardDescription>
            Configure how Claude connects to the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-3 block">Dashboard URL</label>
              <div className="flex gap-2">
                <Input
                  value={dashboardUrlInput}
                  onChange={(e) => setUserDashboardUrl(e.target.value)}
                  placeholder="http://localhost:4000"
                  className="w-[300px]"
                  disabled={loading}
                />
                <Button
                  onClick={saveDashboardUrl}
                  disabled={loading || updateSettings.isPending}
                >
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                URL Claude uses to signal story completion. Change if running on a different port.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
