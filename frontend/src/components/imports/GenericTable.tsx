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
        preserveSelectedRowKeys: true,
      }
    : undefined;

  return (
    <Table<T>
      columns={columnsWithEllipsis}
      dataSource={data}
      rowKey={rowKey}
      loading={loading}
      pagination={pagination}
      tableLayout="fixed"
      onChange={(pagination) => {
        if (onChange) {
          onChange(pagination);
        }
      }}
      rowSelection={rowSelection}
      className='shadow-soft bg-white rounded border border-border'
      style={{ width: '100%' }}
    />
  );
}
