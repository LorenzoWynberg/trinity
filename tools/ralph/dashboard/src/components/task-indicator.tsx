'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTaskContext, type Task } from './task-provider';
import { useTaskStore } from '@/lib/task-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function getTaskLabel(type: Task['type']) {
  switch (type) {
    case 'refine':
      return 'Refine';
    case 'generate':
      return 'Generate';
    case 'story-edit':
      return 'Story Edit';
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export function TaskIndicator() {
  const { activeTasks, unreadTasks, unseenCount, refreshTasks } =
    useTaskContext();
  const { addPendingTask } = useTaskStore();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const handleClearTasks = async () => {
    try {
      await fetch('/api/tasks/clear', { method: 'POST' });
      refreshTasks();
    } catch (error) {
      console.error('Failed to mark tasks as read:', error);
    }
  };

  // Navigate to the appropriate page and set the pending task
  const handleTaskClick = async (task: Task) => {
    if (task.status !== 'complete' && task.status !== 'failed') {
      return;
    }

    const returnPath = task.context?.returnPath || '/stories';

    // Store full task data for the modal
    addPendingTask(task);

    // Mark the task as read
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read' }),
      });
      refreshTasks();
    } catch (e) {
      console.error('Failed to mark task as read:', e);
    }

    setOpen(false);

    if (returnPath) {
      window.location.href = returnPath;
    }
  };

  const hasActive = activeTasks.length > 0;
  const runningTask = activeTasks.find((t) => t.status === 'running');
  const queuedCount = activeTasks.filter((t) => t.status === 'queued').length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-2 relative group',
            hasActive && 'border-primary cyber-dark:border-accent',
          )}
        >
          {hasActive ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">
                {runningTask ? getTaskLabel(runningTask.type) : 'Tasks'}
                {queuedCount > 0 && ` +${queuedCount}`}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Tasks</span>
            </>
          )}
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground cyber-dark:bg-accent cyber-dark:text-accent-foreground cyber-dark:group-hover:bg-card cyber-dark:group-hover:text-accent cyber-dark:group-hover:border cyber-dark:group-hover:border-accent flex items-center justify-center">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {activeTasks.length > 0 && (
          <>
            <DropdownMenuLabel>Running</DropdownMenuLabel>
            {activeTasks.map((task) => (
              <DropdownMenuItem
                key={task.id}
                className="flex items-center gap-2 cyber-dark:hover:text-background cyber-dark:hover:[&_svg]:text-background"
              >
                {task.status === 'running' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary cyber-dark:text-accent" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1">{getTaskLabel(task.type)}</span>
                <span className="text-xs text-muted-foreground">
                  {task.version}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Unread</span>
          {unreadTasks.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                handleClearTasks();
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
        {unreadTasks.length === 0 ? (
          <DropdownMenuItem disabled>No unread tasks</DropdownMenuItem>
        ) : (
          unreadTasks.map((task) => (
            <DropdownMenuItem
              key={task.id}
              className="flex items-center gap-2 cursor-pointer cyber-dark:hover:text-background cyber-dark:hover:[&_svg]:text-background cyber-dark:hover:[&_.time-text]:text-background/70"
              onClick={() => handleTaskClick(task)}
            >
              {task.status === 'complete' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="flex-1 truncate">{getTaskLabel(task.type)}</span>
              <span className="time-text text-xs text-muted-foreground">
                {formatTime(task.completed_at || task.created_at)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
