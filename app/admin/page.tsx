import { redirect } from "next/navigation";

/* /admin opens on Customers. */
export default function AdminIndex() {
  redirect("/admin/customers");
}
