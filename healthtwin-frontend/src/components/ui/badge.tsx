import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
      severity: {
        default: "",
        low: "border-transparent bg-risk-low/20 text-risk-low hover:bg-risk-low/30",
        moderate: "border-transparent bg-risk-moderate/20 text-risk-moderate hover:bg-risk-moderate/30",
        elevated: "border-transparent bg-risk-elevated/20 text-risk-elevated hover:bg-risk-elevated/30",
        high: "border-transparent bg-risk-high/20 text-risk-high hover:bg-risk-high/30",
      }
    },
    defaultVariants: {
      variant: "default",
      severity: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, severity, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, severity }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
