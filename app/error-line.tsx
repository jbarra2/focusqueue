/**
 * A refusal or a failure, in one line that starts with the word Error, so it does not rest on its
 * red. It is announced when it appears. Whatever text it is given is shown as plain text.
 */
export function ErrorLine({ message }: { message: string }) {
  return (
    <p className="form-error" role="alert">
      <strong>Error:</strong> {message}
    </p>
  );
}
