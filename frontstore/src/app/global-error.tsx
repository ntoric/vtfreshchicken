"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 max-w-md mb-2">
            An unexpected error occurred. Please try again.
          </p>
          {error?.message && (
            <pre className="text-xs text-rose-600 bg-rose-50 rounded-lg px-4 py-2 mt-3 max-w-lg overflow-x-auto">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3 mt-8">
            <button
              onClick={reset}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              Try again
            </button>
            <a
              href="/"
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
