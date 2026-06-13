import SydINWordmark, {
  type SydINWordmarkVariant,
} from "@/components/brand/SydINWordmark";

interface WordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: SydINWordmarkVariant;
}

export default function Wordmark({
  className = "",
  size = "md",
  variant = "theme",
}: WordmarkProps) {
  return (
    <SydINWordmark className={className} size={size} variant={variant} />
  );
}
