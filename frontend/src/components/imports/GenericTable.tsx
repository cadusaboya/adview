import { Table } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import React from 'react';
import './GenericTable.css';

type GenericTableProps<T> = {
  columns: TableColumnsType<T>;
  data: T[];
  rowKey?: string;
  loading?: boolean;
  pagination?: false | TablePaginationConfig;
  onChange?: (pagination: TablePaginationConfig) => void;
  onSortChange?: (ordering: string) => void;
  // Row selection props
  selectedRowKeys?: React.Key[];
  onSelectionChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
  // Clear selection on page change
  clearSelectionOnPageChange?: boolean;
};

export default function GenericTable<T extends object>({
  columns,
  data,
  rowKey = 'id',
  loading = false,
  pagination,
  onChange,
  onSortChange,
  selectedRowKeys,
  onSelectionChange,
  clearSelectionOnPageChange = true,
}: GenericTableProps<T>) {
  // Aplica ellipsis em todas as colunas que não têm configuração explícita
  const columnsWithEllipsis = columns.map((col) => ({
    ...col,
    ellipsis: col.ellipsis !== undefined ? col.ellipsis : true,
  }));

  // Row selection configuration
  const rowSelection = onSelectionChange
    ? {
        selectedRowKeys,
        onChange: onSelectionChange,
        preserveSelectedRowKeys: false,
      }
    : undefined;

  // Handle pagination + sort changes
  const handleTableChange = (
    newPagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<T> | SorterResult<T>[]
  ) => {
    if (onChange) {
      onChange(newPagination);
    }

    // Clear selection when page or pageSize changes
    if (clearSelectionOnPageChange && onSelectionChange) {
      const currentPage = pagination && typeof pagination === 'object' ? pagination.current : 1;
      const currentPageSize = pagination && typeof pagination === 'object' ? pagination.pageSize : 10;

      if (
        newPagination.current !== currentPage ||
        newPagination.pageSize !== currentPageSize
      ) {
        onSelectionChange([], []);
      }
    }

    // Emit sort change
    if (onSortChange) {
      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      if (s.order && s.field) {
        const field = String(s.field);
        onSortChange(s.order === 'ascend' ? field : `-${field}`);
      } else {
        onSortChange('');
      }
    }
  };

  return (
    <Table<T>
      columns={columnsWithEllipsis}
      dataSource={data}
      rowKey={rowKey}
      loading={loading}
      pagination={pagination}
      tableLayout="fixed"
      onChange={handleTableChange}
      rowSelection={rowSelection}
      showSorterTooltip={false}
      className='shadow-soft bg-white rounded border border-border'
      style={{ width: '100%' }}
    />
  );
}
