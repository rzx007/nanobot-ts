import * as React from "react"

export const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`space-y-2 ${className}`}
      {...props}
    />
  )
})
FormItem.displayName = "FormItem"