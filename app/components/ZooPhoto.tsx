import type { AnimalKey } from "../zoo-data";

export function ZooPhoto({ animal, alt, className }: { animal: AnimalKey; alt: string; className?: string }) {
  return <img className={`zoo-photo animal-${animal}${className ? ` ${className}` : ""}`} src={`/animals-clean/${animal}.png?v=2`} alt={alt} loading="lazy" />;
}
