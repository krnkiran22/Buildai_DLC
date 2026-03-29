import { PublicQrPage } from "@/components/public-qr-page";

export const dynamic = "force-dynamic";

export default async function QrTokenPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  return <PublicQrPage qrToken={qrToken} />;
}
