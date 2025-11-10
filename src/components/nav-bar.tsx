"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function NavBar() {
  const { data: session } = useSession();

  return (
    <nav className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
      <span className="text-lg font-bold text-white">AfterWeb</span>
      <div>
        {session?.user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">{session.user.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg bg-gray-800 px-3 py-1 text-sm text-white transition hover:bg-gray-700"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn()}
            className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white transition hover:bg-blue-700"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
