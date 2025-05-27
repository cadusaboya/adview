import { Table } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import React from 'react';

type GenericTableProps<T> = {
  columns: TableColumnsType<T>;
  data: T[];
  rowKey?: keyof T;
  loading?: boolean;
  pagination?: false | TablePaginationConfig;
  onChange?: (pagination: TablePaginationConfig) => void;
};

export default function GenericTable<T extends object>({
  columns,
  data,
  rowKey = 'id',
  loading = false,
  pagination,
  onChange,
}: GenericTableProps<T>) {
  return (
    <Table<T>
      columns={columns}
      dataSource={data}
      rowKey={rowKey as string}
      loading={loading}
      pagination={pagination}
      scroll={{ x: 'max-content' }}
      onChange={(pagination) => {
        if (onChange) {
          onChange(pagination);
        }
      }}
      className='shadow-md bg-white'
    />
  );
}
