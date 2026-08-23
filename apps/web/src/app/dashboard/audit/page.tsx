'use client';

import { useEffect, useMemo, useState } from 'react';
import { audit, type AuditLogEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextMuted } from '@/components/ui/Typography';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ClipboardList } from 'lucide-react';

const POLL_MS = 10_000;

function actionVariant(action: string): BadgeVariant {
  if (action.includes('delete') || action.includes('reject')) return 'danger';
  if (action.includes('approve') || action.includes('publish') || action.includes('create')) return 'success';
  if (action.includes('update')) return 'warning';
  return 'default';
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    function load() {
      audit.list()
        .then((list) => {
          if (!cancelled) setEntries(list);
        })
        .catch((err) => {
          if (!cancelled) showToast('error', err instanceof Error ? err.message : 'Failed to load audit log');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const actionTypes = useMemo(() => {
    const unique = new Set(entries.map((e) => e.action));
    return ['all', ...Array.from(unique).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...entries]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .filter((e) => actionFilter === 'all' || e.action === actionFilter)
      .filter((e) => {
        if (!query) return true;
        const haystack = `${e.action} ${e.resource_type} ${e.resource_id ?? ''}`.toLowerCase();
        return haystack.includes(query);
      });
  }, [entries, actionFilter, search]);

  return (
    <div className="max-w-content mx-auto px-6 py-8 space-y-6 animate-fade-up">
      <PageHero eyebrow="Compliance" title="Audit Log" description="Immutable trail of write/approve/publish actions across your tenant." />

      <div className="flex flex-wrap items-center gap-2">
        {actionTypes.map((type) => (
          <Button
            key={type}
            size="sm"
            variant={actionFilter === type ? 'primary' : 'secondary'}
            onClick={() => setActionFilter(type)}
          >
            {type === 'all' ? 'All' : type}
          </Button>
        ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resource…"
          className="ml-auto max-w-xs"
        />
      </div>

      {loading ? (
        <SkeletonTable />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No audit entries found" description="Actions will appear here as your team works." />
      ) : (
        <Card elevated>
          <CardBody className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Resource</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted">
                      {entry.resource_type}
                      {entry.resource_id && <span className="ml-1 font-mono text-xs">{entry.resource_id}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
