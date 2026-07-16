import { redirect } from "next/navigation";

export default function BookIndex() {
  redirect("/dashboard/firm/book/journal");
}
