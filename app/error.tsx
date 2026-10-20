"use client";

// Next logs the real error on the server. The page shows one sentence, never the message or stack.
// The layout puts it in the full-height column, like every page.
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main>
      <h1>Focusqueue</h1>
      <p role="alert">The task list could not be loaded. Try again, or restart the app.</p>
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
