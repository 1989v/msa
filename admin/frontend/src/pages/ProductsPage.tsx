import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, useReactTable, getCoreRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/api/products';
import type { Product } from '@/api/products';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<Product>();

type ProductFormData = Omit<Product, 'id' | 'createdAt'>;

const EMPTY_FORM: ProductFormData = {
  name: '',
  price: 0,
  category: '',
  status: 'ACTIVE',
  stockQuantity: 0,
  description: '',
};

function ProductFormDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = product !== null;
  const [form, setForm] = useState<ProductFormData>(
    isEdit
      ? {
          name: product.name,
          price: product.price,
          category: product.category,
          status: product.status,
          stockQuantity: product.stockQuantity,
          description: product.description,
        }
      : EMPTY_FORM
  );

  const createMutation = useMutation({
    mutationFn: () => createProduct(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateProduct(product!.id, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      open
      title={isEdit ? '상품 수정' : '상품 등록'}
      onClose={onClose}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium">상품명</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">가격</label>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              required
              min={0}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">재고</label>
            <Input
              type="number"
              value={form.stockQuantity}
              onChange={(e) => setForm({ ...form, stockQuantity: Number(e.target.value) })}
              required
              min={0}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">카테고리</label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">상태</label>
            <Input
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">설명</label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={isPending}>
            {isEdit ? '수정' : '등록'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ProductsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['products', page, search],
    queryFn: () => fetchProducts(page, 20, search || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const products = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleRowClick = (product: Product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setDialogOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('삭제하시겠습니까?')) {
      deleteMutation.mutate(id);
    }
  };

  const columns: ColumnDef<Product, string>[] = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: (info) => info.getValue(),
    }) as ColumnDef<Product, string>,
    columnHelper.accessor('name', { header: '상품명' }) as ColumnDef<Product, string>,
    columnHelper.accessor('price', {
      header: '가격',
      cell: (info) => `₩${Number(info.getValue()).toLocaleString()}`,
    }) as ColumnDef<Product, string>,
    columnHelper.accessor('category', { header: '카테고리' }) as ColumnDef<Product, string>,
    columnHelper.accessor('status', {
      header: '상태',
      cell: (info) => <Badge>{info.getValue()}</Badge>,
    }) as ColumnDef<Product, string>,
    columnHelper.accessor('stockQuantity', { header: '재고' }) as ColumnDef<Product, string>,
    columnHelper.accessor('createdAt', {
      header: '등록일',
      cell: (info) => new Date(info.getValue()).toLocaleDateString('ko-KR'),
    }) as ColumnDef<Product, string>,
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => handleDelete(e, row.original.id)}
          disabled={deleteMutation.isPending}
        >
          삭제
        </Button>
      ),
    }) as ColumnDef<Product, string>,
  ];

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <Button onClick={handleCreate}>등록</Button>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="상품명 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm">검색</Button>
      </form>
      <DataTable table={table} onRowClick={handleRowClick} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {dialogOpen && (
        <ProductFormDialog
          product={selectedProduct}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
