import * as React from "react"
import { cn } from "@/lib/utils"

interface SplitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  children: React.ReactNode
  size?: "default" | "sm" | "lg"
}

function SplitButton({
  className,
  icon,
  children,
  size = "default",
  ...props
}: SplitButtonProps) {
  const sizeClasses = {
    default: "h-9 text-sm",
    sm: "h-8 text-sm",
    lg: "h-10 text-base",
  }

  const iconSizeClasses = {
    default: "px-2.5",
    sm: "px-2",
    lg: "px-3",
  }

  const textSizeClasses = {
    default: "px-3",
    sm: "px-2.5",
    lg: "px-4",
  }

  return (
    <button
      className={cn(
        "group inline-flex items-stretch rounded-md border overflow-hidden font-medium transition-all",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "border-border dark:border-input",
        "cyber-light:border-cyan-500 cyber-light:hover:border-yellow-400",
        "cyber-dark:border-border cyber-dark:hover:border-yellow-400 cyber-dark:hover:bg-yellow-400",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {/* Icon section - goes pink bg on hover */}
      <span
        className={cn(
          "inline-flex items-center justify-center border-r transition-colors",
          "bg-muted text-muted-foreground",
          "cyber-light:bg-white cyber-light:text-pink-500 cyber-light:border-r-cyan-500",
          "cyber-light:group-hover:bg-pink-500 cyber-light:group-hover:text-white cyber-light:group-hover:border-r-cyan-500",
          "cyber-dark:bg-transparent cyber-dark:text-foreground cyber-dark:border-r-0",
          "cyber-dark:group-hover:bg-transparent cyber-dark:group-hover:text-black",
          iconSizeClasses[size]
        )}
      >
        {icon}
      </span>
      {/* Text section - changes on hover */}
      <span
        className={cn(
          "inline-flex items-center justify-center transition-colors",
          "bg-background text-foreground",
          "group-hover:bg-accent group-hover:text-accent-foreground",
          "cyber-light:bg-white cyber-light:text-foreground",
          "cyber-light:group-hover:bg-cyan-500 cyber-light:group-hover:text-white",
          "cyber-dark:bg-transparent cyber-dark:text-foreground",
          "cyber-dark:group-hover:bg-transparent cyber-dark:group-hover:text-black",
          textSizeClasses[size]
        )}
      >
        {children}
      </span>
    </button>
  )
}

export { SplitButton }
