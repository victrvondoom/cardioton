import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/grok_app__lib__routes";

export default function Home() {
  redirect(ROUTES.dashboard);
}
