import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, useReactTable, getCoreRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  fetchMembers,
  fetchMemberRoles,
  assignRole,
  removeRole,
} from '@/api/members';
import type { Member, MemberRole } from '@/api/members';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<Member>();

const ROLE_OPTIONS = ['ROLE_USER', 'ROLE_SELLER', 'ROLE_ADMIN'];

function MemberDetailDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0]);

  const { data: roles = [] } = useQuery({
    queryKey: ['memberRoles', member.id],
    queryFn: () => fetchMemberRoles(member.id),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignRole(member.id, selectedRole),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memberRoles', member.id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (role: string) => removeRole(member.id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memberRoles', member.id] });
    },
  });

  return (
    <Dialog open title={`회원 상세 — ${member.name}`} onClose={onClose} className="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-zinc-500">ID</div><div>{member.id}</div>
          <div className="text-zinc-500">이메일</div><div>{member.email}</div>
          <div className="text-zinc-500">이름</div><div>{member.name}</div>
          <div className="text-zinc-500">SSO</div><div>{member.ssoProvider}</div>
          <div className="text-zinc-500">상태</div><div>{member.status}</div>
          <div className="text-zinc-500">가입일</div><div>{new Date(member.createdAt).toLocaleDateString('ko-KR')}</div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-700" />

        <div>
          <h3 className="text-sm font-medium mb-2">역할 관리</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {roles.length === 0 && <span className="text-sm text-zinc-500">역할 없음</span>}
            {roles.map((r: MemberRole) => (
              <div key={r.role} className="flex items-center gap-1">
                <Badge>{r.role}</Badge>
                <button
                  onClick={() => removeMutation.mutate(r.role)}
                  className="text-xs text-red-500 hover:text-red-700"
                  disabled={removeMutation.isPending}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="flex-1"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
              size="sm"
            >
              역할 부여
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function MembersPage() {
  const [page, setPage] = useState(0);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const { data } = useQuery({
    queryKey: ['members', page],
    queryFn: () => fetchMembers(page, 20),
  });

  const members = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const columns: ColumnDef<Member, string>[] = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: (info) => info.getValue(),
    }) as ColumnDef<Member, string>,
    columnHelper.accessor('email', { header: '이메일' }) as ColumnDef<Member, string>,
    columnHelper.accessor('name', { header: '이름' }) as ColumnDef<Member, string>,
    columnHelper.accessor('ssoProvider', { header: 'SSO' }) as ColumnDef<Member, string>,
    columnHelper.accessor('status', {
      header: '상태',
      cell: (info) => <Badge>{info.getValue()}</Badge>,
    }) as ColumnDef<Member, string>,
    columnHelper.accessor('createdAt', {
      header: '가입일',
      cell: (info) => new Date(info.getValue()).toLocaleDateString('ko-KR'),
    }) as ColumnDef<Member, string>,
  ];

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">회원 관리</h1>
      <DataTable table={table} onRowClick={setSelectedMember} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {selectedMember && (
        <MemberDetailDialog member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}
