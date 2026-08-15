import { Suspense } from "react";
import { InsuranceComparator } from "@/components/InsuranceComparator";

export default function Home() {
  return (
    // useSearchParams requires a Suspense boundary in the App Router.
    <Suspense fallback={null}>
      <InsuranceComparator />
    </Suspense>
  );
}
