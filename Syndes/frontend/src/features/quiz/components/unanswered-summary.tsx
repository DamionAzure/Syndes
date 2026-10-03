import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Lists unanswered Questions by number with a way to each; submitting is still allowed. */
export function UnansweredSummary({
  numbers,
  onGoTo,
}: {
  numbers: number[];
  onGoTo: (question: number) => void;
}) {
  if (numbers.length === 0) return null;
  const count = numbers.length;

  return (
    <Alert role="status" className="mt-8">
      <AlertTitle>
        {count === 1 ? "1 question is unanswered" : `${count} questions are unanswered`}
      </AlertTitle>
      <AlertDescription className="text-foreground">
        <p>You can still submit, or go back to answer:</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {numbers.map((number) => (
            <li key={number}>
              <button
                type="button"
                onClick={() => onGoTo(number)}
                className="min-h-(--control-height) rounded-sm px-2 text-primary underline underline-offset-4"
              >
                Question {number}
              </button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
