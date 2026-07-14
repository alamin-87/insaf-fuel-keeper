import { cn } from "@/lib/utils";

const LOGO_SRC = "/favicon.png?v=4";

type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
};

const SIZE_CLASS: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
};

export function BrandLogo({ className, size = "md", alt = "Insaf Gas Corp" }: BrandLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      draggable={false}
      className={cn("shrink-0 rounded-md object-contain", SIZE_CLASS[size], className)}
    />
  );
}
