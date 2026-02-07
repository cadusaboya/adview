import { Table } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import React from 'react';
import './GenericTable.css';

type GenericTableProps<T> = {
  columns: TableColumnsType<T>;
  data: T[];
  rowKey?: string;
  loading?: boolean;
  pagination?: false | TablePaginationConfig;
  onChange?: (pagination: TablePaginationConfig) => void;
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
  selectedRowKeys,
  onSelectionChange,
  clearSelectionOnPageChange = true,
}: GenericTableProps<T>) {
  // Aplica ellipsis em todas as colunas que não têm configuração explícita
  const columnsWithEllipsis = columns.map((col) => ({
    ...col,
    ellipsis: col.ellipsis !== undefined ? col.ellipsis : {
      showTitle: true,
    },
  }));

  // Row selection configuration
  const rowSelection = onSelectionChange
    ? {
        selectedRowKeys,
        onChange: onSelectionChange,
        preserveSelectedRowKeys: false, // Changed to false to prevent issues with pagination
      }
    : undefined;

  // Handle pagination changes
  const handleTableChange = (newPagination: TablePaginationConfig) => {
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
      className='shadow-soft bg-white rounded border border-border'
      style={{ width: '100%' }}
    />
  );
}
