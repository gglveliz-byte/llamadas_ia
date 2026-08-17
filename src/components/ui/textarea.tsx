import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 aria-invalid:ring-destructive/20 aria-invalid:border-destructive bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
