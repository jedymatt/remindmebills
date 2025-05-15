import { AuthenticatedLayout } from "~/components/authenticatedLayout";

export default async function BillsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
