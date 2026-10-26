export function DishPhoto({ url, alt, className = "" }: { url: string | null; alt: string; className?: string }) {
  if (url) return <img src={url} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
  return <div aria-hidden="true" className={`bg-photo ${className}`} />;
}
