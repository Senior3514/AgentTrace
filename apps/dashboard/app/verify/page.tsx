import { PageHeader } from "../../components/ui";
import { VerifyForm } from "../../components/VerifyForm";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <>
      <PageHeader
        title="Verify a receipt"
        subtitle="Paste any AgentTrace receipt to check its integrity and signature — independently, with no API or private key."
      />
      <VerifyForm />
    </>
  );
}
