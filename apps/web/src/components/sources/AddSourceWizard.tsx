'use client';

import { useState } from 'react';
import { products } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextMuted } from '@/components/ui/Typography';

export type SourceKind =
  | 'website'
  | 'file'
  | 'spreadsheet'
  | 'youtube'
  | 'audio_video'
  | 'github'
  | 'openapi'
  | 'database';

export const SOURCE_OPTIONS: { kind: SourceKind; label: string; description: string }[] = [
  { kind: 'website', label: 'Website / URL', description: 'Docs, blog, or any crawlable site' },
  { kind: 'file', label: 'Document', description: 'PDF, DOCX, PPT, TXT, Markdown' },
  { kind: 'spreadsheet', label: 'Spreadsheet', description: 'CSV or Excel (.xlsx)' },
  { kind: 'youtube', label: 'YouTube', description: 'Video URL with captions' },
  { kind: 'audio_video', label: 'Audio / Video file', description: 'Upload for transcription' },
  { kind: 'github', label: 'GitHub', description: 'Repository README and docs' },
  { kind: 'openapi', label: 'OpenAPI', description: 'Swagger / OpenAPI spec URL or file' },
  { kind: 'database', label: 'Database', description: 'Live read-only or upload dump' },
];

interface Props {
  productId: string;
  onClose: () => void;
  onCreated: () => void;
  /** Skip the kind picker and open straight to step 2 pre-set to this kind --
   * e.g. a one-click "Import from GitHub" entry point elsewhere in the UI. */
  initialKind?: SourceKind;
}

export default function AddSourceWizard({ productId, onClose, onCreated, initialKind }: Props) {
  const [step, setStep] = useState<1 | 2>(initialKind ? 2 : 1);
  const [kind, setKind] = useState<SourceKind | null>(initialKind ?? null);
  const [url, setUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [dbMode, setDbMode] = useState<'live' | 'upload'>('live');
  const [dbEngine, setDbEngine] = useState('postgresql');
  const [dbHost, setDbHost] = useState('localhost');
  const [dbPort, setDbPort] = useState('5432');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [autoIngest, setAutoIngest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function testDbConnection() {
    setLoading(true);
    setError(null);
    try {
      const res = await products.testDatabaseConnection(productId, {
        engine: dbEngine,
        host: dbHost,
        port: parseInt(dbPort, 10) || undefined,
        database: dbName,
        username: dbUser,
        password: dbPassword,
      });
      setAvailableTables(res.tables);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setLoading(true);
    setError(null);

    try {
      let sourceId: string | undefined;

      if (kind === 'website') {
        const s = await products.addSource(productId, {
          source_type: url.includes('blog') ? 'blog' : 'docs',
          url,
          display_name: displayName || undefined,
        });
        sourceId = s.id;
      } else if (kind === 'youtube') {
        const s = await products.addSource(productId, {
          source_type: 'video',
          url,
          display_name: displayName || 'YouTube video',
        });
        sourceId = s.id;
      } else if (kind === 'github') {
        const s = await products.addSource(productId, {
          source_type: 'github',
          url,
          display_name: displayName || undefined,
          github_token: githubToken || undefined,
        });
        sourceId = s.id;
      } else if (kind === 'openapi') {
        if (file) {
          const s = await products.uploadSource(productId, file, 'openapi', displayName || file.name);
          sourceId = s.id;
        } else {
          const s = await products.addSource(productId, {
            source_type: 'openapi',
            url,
            display_name: displayName || undefined,
          });
          sourceId = s.id;
        }
      } else if (kind === 'file' && file) {
        const s = await products.uploadSource(productId, file, 'file', displayName || file.name);
        sourceId = s.id;
      } else if (kind === 'spreadsheet' && file) {
        const s = await products.uploadSource(productId, file, 'spreadsheet', displayName || file.name);
        sourceId = s.id;
      } else if (kind === 'audio_video' && file) {
        const st = file.type.startsWith('audio/') ? 'audio' : 'video';
        const s = await products.uploadSource(productId, file, st, displayName || file.name);
        sourceId = s.id;
      } else if (kind === 'database') {
        if (dbMode === 'upload' && file) {
          const s = await products.uploadSource(productId, file, 'database', displayName || file.name);
          sourceId = s.id;
        } else if (dbMode === 'live') {
          const s = await products.addDatabaseSource(productId, {
            engine: dbEngine,
            host: dbHost,
            port: parseInt(dbPort, 10) || undefined,
            database: dbName,
            username: dbUser,
            password: dbPassword,
            tables: dbTables,
            display_name: displayName || `DB ${dbName}`,
          });
          sourceId = s.id;
        } else {
          throw new Error('Select database upload file or configure live connection');
        }
      } else {
        throw new Error('Complete all required fields');
      }

      if (autoIngest && sourceId) {
        await products.ingest(productId, { source_ids: [sourceId], async_mode: true });
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add knowledge source" className="max-w-2xl">
      {step === 1 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              className="text-left rounded-lg border border-border p-4 hover:border-primary/50 transition-colors focus-ring"
              onClick={() => {
                setKind(opt.kind);
                setStep(2);
              }}
            >
              <p className="font-medium">{opt.label}</p>
              <TextMuted className="mt-1">{opt.description}</TextMuted>
            </button>
          ))}
        </div>
      )}

      {step === 2 && kind && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-body-sm font-medium mb-1">Display name (optional)</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Product demo video"
            />
          </div>

          {(kind === 'website' || kind === 'youtube' || kind === 'github') && (
            <div>
              <label className="block text-body-sm font-medium mb-1">URL</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://…"
              />
            </div>
          )}

          {kind === 'openapi' && !file && (
            <div>
              <label className="block text-body-sm font-medium mb-1">Spec URL (or upload file below)</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/openapi.json"
              />
            </div>
          )}

          {kind === 'github' && (
            <div>
              <label className="block text-body-sm font-medium mb-1">GitHub token (optional)</label>
              <Input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
            </div>
          )}

          {(kind === 'file' || kind === 'spreadsheet' || kind === 'audio_video' || kind === 'openapi') && (
            <div>
              <label className="block text-body-sm font-medium mb-1">Upload file</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-body-sm"
                accept={
                  kind === 'spreadsheet'
                    ? '.csv,.xlsx,.xls'
                    : kind === 'audio_video'
                      ? 'audio/*,video/*'
                      : kind === 'file'
                        ? '.pdf,.docx,.ppt,.pptx,.txt,.md'
                        : undefined
                }
              />
            </div>
          )}

          {kind === 'database' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={dbMode === 'live' ? 'primary' : 'secondary'}
                  onClick={() => setDbMode('live')}
                >
                  Live connection
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dbMode === 'upload' ? 'primary' : 'secondary'}
                  onClick={() => setDbMode('upload')}
                >
                  Upload dump
                </Button>
              </div>

              {dbMode === 'live' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-body-sm font-medium mb-1">Engine</label>
                      <Input value={dbEngine} onChange={(e) => setDbEngine(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium mb-1">Host</label>
                      <Input value={dbHost} onChange={(e) => setDbHost(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium mb-1">Port</label>
                      <Input value={dbPort} onChange={(e) => setDbPort(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium mb-1">Database</label>
                      <Input value={dbName} onChange={(e) => setDbName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium mb-1">Username</label>
                      <Input value={dbUser} onChange={(e) => setDbUser(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium mb-1">Password</label>
                      <Input type="password" value={dbPassword} onChange={(e) => setDbPassword(e.target.value)} required />
                    </div>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={testDbConnection} disabled={loading}>
                    Test connection
                  </Button>
                  {availableTables.length > 0 && (
                    <div>
                      <p className="text-body-sm font-medium mb-2">Tables to ingest</p>
                      <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                        {availableTables.map((t) => (
                          <label key={t} className="flex items-center gap-2 text-body-sm">
                            <input
                              type="checkbox"
                              checked={dbTables.includes(t)}
                              onChange={(e) => {
                                setDbTables((prev) =>
                                  e.target.checked ? [...prev, t] : prev.filter((x) => x !== t),
                                );
                              }}
                            />
                            {t}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-body-sm font-medium mb-1">SQL dump or CSV export</label>
                  <input
                    type="file"
                    accept=".sql,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-body-sm"
                  />
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-body-sm">
            <input type="checkbox" checked={autoIngest} onChange={(e) => setAutoIngest(e.target.checked)} />
            Start ingest after adding
          </label>

          {error && <TextMuted className="text-warning">{error}</TextMuted>}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding…' : 'Add source'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
