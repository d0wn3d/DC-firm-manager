import { redirect } from "next/navigation";

export default function FirmIndex() {
  redirect("/dashboard/firm/overview");
}
