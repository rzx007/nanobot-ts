import * as React from "react"

export const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`flex flex-col space-y-2 ${className}`}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"