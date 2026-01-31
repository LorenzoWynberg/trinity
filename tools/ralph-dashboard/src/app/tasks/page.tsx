'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskStore, type Task, type TaskType, type TaskStatus } from '@/lib/task-store'

type FilterStatus = 'all' | 'unread' | 'read' | TaskStatus
type FilterType = 'all' | TaskType

function getTaskLabel(type: Task['type']) {
  switch (type) {
    case 'refine': return 'Refine'
    case 'generate': return 'Generate'
    case 'story-edit': return 'Story Edit'
    case 'align': return 'Align'
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString()
}

function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case 'queued':
      return <Clock className="h-4 w-4 text-muted-foreground" />
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    case 'complete':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />
  }
}

function getStatusBadge(status: TaskStatus) {
  const variants: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    queued: 'outline',
    running: 'default',
    complete: 'secondary',
    failed: 'destructive',
  }
  return <Badge variant={variants[status]}>{status}</Badge>
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleted, setShowDeleted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const { addPendingTask } = useTaskStore()
  const router = useRouter()

  const fetchTasks = useCallback(async () => {
    try {
      const url = new URL('/api/tasks', window.location.origin)
      url.searchParams.set('limit', '100')
      if (showDeleted) {
        url.searchParams.set('includeDeleted', 'true')
      }

      const res = await fetch(url)
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [showDeleted])

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read' })
      })
      fetchTasks()
    } catch (error) {
      console.error('Failed to mark task as read:', error)
    }
  }

  const softDelete = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' })
      })
      fetchTasks()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const restore = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })
      fetchTasks()
    } catch (error) {
      console.error('Failed to restore task:', error)
    }
  }

  const viewResults = (task: Task) => {
    if (task.status !== 'complete' && task.status !== 'failed') return

    const returnPath = task.context?.returnPath || '/stories'

    addPendingTask(task)
    markAsRead(task.id)

    if (returnPath) {
      router.push(returnPath)
    }
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'unread') {
        if (task.read_at) return false
      } else if (statusFilter === 'read') {
        if (!task.read_at) return false
      } else {
        if (task.status !== statusFilter) return false
      }
    }

    // Type filter
    if (typeFilter !== 'all' && task.type !== typeFilter) {
      return false
    }

    return true
  })


  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-foreground">Tasks</h1>
          <p className="text-muted-foreground">
            Manage background tasks
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task History</CardTitle>
              <CardDescription>
                View and manage all background tasks
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FilterType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="refine">Refine</SelectItem>
                  <SelectItem value="generate">Generate</SelectItem>
                  <SelectItem value="story-edit">Story Edit</SelectItem>
                  <SelectItem value="align">Align</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleted(!showDeleted)}
                className={cn(showDeleted && 'bg-muted')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className={cn(
                      task.deleted_at && 'opacity-50',
                      !task.read_at && (task.status === 'complete' || task.status === 'failed') && 'bg-muted/50'
                    )}
                  >
                    <TableCell>
                      {getStatusIcon(task.status)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getTaskLabel(task.type)}
                        {!task.read_at && (task.status === 'complete' || task.status === 'failed') && (
                          <Badge variant="default" className="text-xs">New</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {task.version}
                      </code>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(task.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(task.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.completed_at ? formatTime(task.completed_at) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(task.status === 'complete' || task.status === 'failed') && !task.deleted_at && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewResults(task)}
                              title="View results"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {!task.read_at ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(task.id)}
                                title="Mark as read"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                title="Already read"
                              >
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => softDelete(task.id)}
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {task.deleted_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restore(task.id)}
                            title="Restore"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
