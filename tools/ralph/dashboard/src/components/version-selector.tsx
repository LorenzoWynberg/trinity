'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface VersionSelectorProps {
  versions: string[]
  currentVersion: string
}

function VersionSelectorInner({ versions, currentVersion }: VersionSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleVersionChange = (version: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('version', version)
    router.push(`/?${params.toString()}`)
  }

  // Don't show selector if only one version
  if (versions.length <= 1) {
    return null
  }

  return (
    <Select value={currentVersion} onValueChange={handleVersionChange}>
      <SelectTrigger className="w-[120px] h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version} value={version}>
            {version}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function VersionSelector(props: VersionSelectorProps) {
  return (
    <Suspense fallback={<div className="w-[120px] h-8 bg-muted animate-pulse rounded-md" />}>
      <VersionSelectorInner {...props} />
    </Suspense>
  )
}
