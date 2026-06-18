"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupplementDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/stack");
  }, [router]);
  return <div className="min-h-screen bg-[#08090A]" />;
}
