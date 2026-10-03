import Link from "next/link";

export function Wordmark() {
  return (
    <Link
      href="/"
      className="flex min-h-(--control-height) items-center gap-3 rounded-md text-section font-semibold"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-content-center gap-[3px] rounded-lg bg-primary"
      >
        <span className="block h-[2px] w-4 rounded-full bg-primary-foreground" />
        <span className="block h-[2px] w-4 rounded-full bg-primary-foreground" />
        <span className="block h-[2px] w-3 rounded-full bg-primary-foreground" />
      </span>
      Syndes
    </Link>
  );
}
