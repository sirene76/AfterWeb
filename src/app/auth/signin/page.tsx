"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-white">
      <h1 className="mb-6 text-2xl font-bold">Sign in to AfterWeb</h1>

      <button
        type="button"
        onClick={() => signIn("github")}
        className="mb-3 rounded bg-gray-800 px-4 py-2 transition hover:bg-gray-700"
      >
        Sign in with GitHub
      </button>

      <button
        type="button"
        onClick={() => signIn("credentials")}
        className="rounded bg-blue-600 px-4 py-2 transition hover:bg-blue-700"
      >
        Demo Login
      </button>
    </main>
  );
}
