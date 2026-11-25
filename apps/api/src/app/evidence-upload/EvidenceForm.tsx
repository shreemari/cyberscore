'use client';

import { useState, type ChangeEvent } from 'react';

export default function EvidenceForm({ ticket }: { ticket: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState('');

  async function upload() {
    if (!file || state === 'uploading') return;
    setError('');
    if (file.size > 20 * 1024 * 1024 || file.size === 0) {
      setError('Choose a non-empty file smaller than 20 MB.');
      return;
    }
    setState('uploading');
    try {
      const metadata = { ticket, fileName: file.name, fileType: file.type || 'application/octet-stream' };
      const first = await fetch('/api/v1/evidence/browser-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadata, fileSize: file.size, stage: 'presign' }),
      });
      const signed = await first.json();
      if (!first.ok) throw new Error(signed.error || 'Could not authorize upload.');

      const remote = await fetch(signed.url, {
        method: 'PUT',
        headers: { 'Content-Type': metadata.fileType },
        body: file,
      });
      if (!remote.ok) throw new Error('Storage upload failed. Check your storage CORS configuration.');

      const confirmed = await fetch('/api/v1/evidence/browser-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadata, fileKey: signed.fileKey, stage: 'confirm' }),
      });
      const result = await confirmed.json();
      if (!confirmed.ok) throw new Error(result.error || 'Could not attach evidence.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
      setState('idle');
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#05060d', color: '#f9fafb', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 460, margin: '64px auto', padding: 24, border: '1px solid #374151', borderRadius: 16, background: '#0e1424' }}>
        <h1 style={{ fontSize: 24, marginTop: 0 }}>CyMetric evidence upload</h1>
        {state === 'done' ? (
          <p role="status">Evidence uploaded and linked to your KPI. You can close this page.</p>
        ) : (
          <>
            <p>Select a PDF, image, CSV, Excel or Word document (maximum 20 MB). This secure link expires after five minutes.</p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.csv,.xls,.xlsx,.doc,.docx"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
              style={{ display: 'block', marginBottom: 20, width: '100%' }}
            />
            {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
            <button
              type="button"
              onClick={upload}
              disabled={!file || state === 'uploading'}
              style={{ background: '#3b82f6', color: 'white', border: 0, borderRadius: 10, padding: 14, cursor: 'pointer' }}
            >
              {state === 'uploading' ? 'Uploading…' : 'Upload evidence'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
