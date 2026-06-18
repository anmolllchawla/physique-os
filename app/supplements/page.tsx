"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /supplements has been replaced by the richer /stack (Stack Monitor).
// Redirect any old links/bookmarks.
export default function SupplementsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/stack");
  }, [router]);
  return <div className="min-h-screen bg-[#08090A]" />;
}
