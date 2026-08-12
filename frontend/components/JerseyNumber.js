// The site's signature element: section markers rendered like the number
// on the back of a shirt. Used for nav, section labels, and step counters -
// never just decoration, always labeling the thing next to it.
export default function JerseyNumber({ number, size = "md" }) {
  const sizes = {
    sm: "text-2xl w-10 h-10",
    md: "text-4xl w-14 h-14",
    lg: "text-6xl w-20 h-20",
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-display text-gold border-2 border-gold/70 rounded-sm ${sizes[size]}`}
      aria-hidden="true"
    >
      {number}
    </span>
  );
}
