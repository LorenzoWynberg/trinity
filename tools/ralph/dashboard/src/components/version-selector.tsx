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

interface VersionMetadata {
  version: string
  title?: string
  shortTitle?: string
  description?: string
}

interface VersionSelectorProps {
  versions: string[]
  currentVersion: string
  versionMetadata?: VersionMetadata[]
}

function VersionSelectorInner({ versions, currentVersion, versionMetadata }: VersionSelectorProps) {
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

  // Helper to get display label for a version
  const getLabel = (version: string) => {
    const meta = versionMetadata?.find(m => m.version === version)
    if (meta?.shortTitle) {
      return `${version} - ${meta.shortTitle}`
    }
    return version
  }

  return (
    <Select value={currentVersion} onValueChange={handleVersionChange}>
      <SelectTrigger className="w-[160px] h-8">
        <SelectValue>{getLabel(currentVersion)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version} value={version}>
            {getLabel(version)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function VersionSelector(props: VersionSelectorProps) {
  return (
    <Suspense fallback={<div className="w-[160px] h-8 bg-muted animate-pulse rounded-md" />}>
      <VersionSelectorInner {...props} />
    </Suspense>
  )
}
