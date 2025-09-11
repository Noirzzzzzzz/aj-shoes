export default function RatingStars({ rating = 5 }: { rating?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Rating ${rating}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-yellow-400" : "text-zinc-600"}>★</span>
      ))}
    </div>
  );
}
