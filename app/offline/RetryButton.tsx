"use client";

import { Button } from "@/components/ui";

export default function RetryButton() {
  return (
    <div className="mt-5 flex justify-center">
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}
