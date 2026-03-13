import * as React from "react"

export const Form = React.forwardRef<
  HTMLFormElement,
  React.FormHTMLAttributes<HTMLFormElement>
>(({ className, ...props }, ref) => {
  return (
    <form
      ref={ref}
      className={`space-y-4 ${className}`}
      {...props}
    />
  )
})
Form.displayName = "Form"