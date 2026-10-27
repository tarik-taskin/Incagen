import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Uygulamadaki paneller tek yüzeyden türer; Klasik ve Liquid Glass farkı yalnız `surface` sınıfında tanımlıdır.
const cardVariants = cva("surface relative text-card-foreground", {
  variants: {
    radius: { xl: "rounded-[2rem]", lg: "rounded-[1.75rem]", md: "rounded-3xl", sm: "rounded-2xl" },
    padding: { none: "", sm: "p-4 sm:p-5", md: "p-6 sm:p-7", lg: "p-7 sm:p-10" },
    tone: { default: "", accent: "surface-accent" },
  },
  defaultVariants: { radius: "md", padding: "none", tone: "default" },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  as?: "div" | "section" | "article" | "aside";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ as: Component = "div", className, radius, padding, tone, ...props }, ref) => (
  <Component ref={ref} className={cn(cardVariants({ radius, padding, tone }), className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />,
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cn("text-balance text-lg font-semibold tracking-[-0.025em]", className)} {...props} />,
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-pretty text-sm leading-6 text-muted-foreground", className)} {...props} />,
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center gap-3", className)} {...props} />,
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
