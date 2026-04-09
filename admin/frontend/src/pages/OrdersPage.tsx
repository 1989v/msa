import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, useReactTable, getCoreRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { fetchOrders, fetchOrder, updateOrderStatus } from '@/api/orders';
import type { Order, OrderDetail } from '@/api/orders';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<Order>();

const STATUS_OPTIONS = ['', 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
const STATUS_LABELS: Record<string, string> = {
  '': '전체',
  PENDING: 'PENDING',
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function OrderDetailDialog({
  orderId,
  onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery<OrderDetail | null>({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading || !order) {
    return (
      <Dialog open title="주문 상세" onClose={onClose}>
        <div className="py-8 text-center text-zinc-500">로딩 중...</div>
      </Dialog>
    );
  }

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];

  return (
    <Dialog open title={`주문 상세 #${order.id}`} onClose={onClose} className="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-zinc-500">주문 ID</div><div>{order.id}</div>
          <div className="text-zinc-500">주문자 ID</div><div>{order.memberId}</div>
          <div className="text-zinc-500">총금액</div><div>₩{Number(order.totalAmount).toLocaleString()}</div>
          <div className="text-zinc-500">상태</div><div><Badge>{order.status}</Badge></div>
          <div className="text-zinc-500">주문일</div><div>{new Date(order.createdAt).toLocaleString('ko-KR')}</div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-700" />

        <div>
          <h3 className="text-sm font-medium mb-2">주문 항목</h3>
          {order.items.length === 0 ? (
            <p className="text-sm text-zinc-500">항목 없음</p>
          ) : (
            <div className="space-y-1">
              {order.items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span>{item.productName} x {item.quantity}</span>
                  <span>₩{Number(item.price).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {nextStatuses.length > 0 && (
          <>
            <hr className="border-zinc-200 dark:border-zinc-700" />
            <div>
              <h3 className="text-sm font-medium mb-2">상태 변경</h3>
              <div className="flex gap-2 flex-wrap">
                {nextStatuses.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === 'CANCELLED' ? 'destructive' : 'default'}
                    onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

export function OrdersPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ['orders', page, statusFilter],
    queryFn: () => fetchOrders(page, 20, statusFilter || undefined),
  });

  const orders = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(0);
  };

  const columns: ColumnDef<Order, string>[] = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: (info) => info.getValue(),
    }) as ColumnDef<Order, string>,
    columnHelper.accessor('memberId', { header: '주문자 ID' }) as ColumnDef<Order, string>,
    columnHelper.accessor('totalAmount', {
      header: '총금액',
      cell: (info) => `₩${Number(info.getValue()).toLocaleString()}`,
    }) as ColumnDef<Order, string>,
    columnHelper.accessor('status', {
      header: '상태',
      cell: (info) => <Badge>{info.getValue()}</Badge>,
    }) as ColumnDef<Order, string>,
    columnHelper.accessor('createdAt', {
      header: '주문일',
      cell: (info) => new Date(info.getValue()).toLocaleDateString('ko-KR'),
    }) as ColumnDef<Order, string>,
  ];

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">주문 관리</h1>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">상태 필터</label>
        <Select value={statusFilter} onChange={handleStatusChange}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>
      <DataTable table={table} onRowClick={(order) => setSelectedOrderId(order.id)} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {selectedOrderId !== null && (
        <OrderDetailDialog
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}
