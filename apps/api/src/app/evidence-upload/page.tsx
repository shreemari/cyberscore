import { notFound } from 'next/navigation';
import { verifyEvidenceTicket } from '@/lib/evidence-ticket';
import EvidenceForm from './EvidenceForm';

export const dynamic = 'force-dynamic';

export default async function EvidenceUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { ticket } = await searchParams;
  if (!ticket || !verifyEvidenceTicket(ticket)) notFound();
  return <EvidenceForm ticket={ticket} />;
}
