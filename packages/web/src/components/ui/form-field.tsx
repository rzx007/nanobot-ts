import * as React from "react"

export const FormField = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`space-y-1 ${className}`}
      {...props}
    />
  )
})
FormField.displayName = "FormField"