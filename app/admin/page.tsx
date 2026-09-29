import { redirect } from "next/navigation";

/* /admin has one screen today: plan requests + Record a payment. */
export default function AdminIndex() {
  redirect("/admin/plan-requests");
}
