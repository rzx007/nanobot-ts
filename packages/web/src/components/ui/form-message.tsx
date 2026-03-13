import * as React from "react"

export const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={`text-sm text-red-500 ${className}`}
      {...props}
    >
      {children}
    </p>
  )
})
FormMessage.displayName = "FormMessage"