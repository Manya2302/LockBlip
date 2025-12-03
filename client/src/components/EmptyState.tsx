import { cn } from "@/lib/utils";

interface EmptyStateProps {
  image: string;
  title: string;
  description: string;
  className?: string;
}

export default function EmptyState({
  image,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-8 text-center",
        className
      )}
      data-testid="empty-state"
    >
      <img
        src={image}
        alt={title}
        className="w-64 h-48 object-contain mb-6 opacity-80"
      />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
