import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import React from 'react';

type GenericTableProps<T> = {
  columns: TableColumnsType<T>;
  data: T[];
  rowKey?: keyof T;
};

export default function GenericTable<T extends object>({
  columns,
  data,
  rowKey = 'id',
}: GenericTableProps<T>) {
  return (
    <Table<T>
      columns={columns}
      dataSource={data}
      rowKey={rowKey as string}
      pagination={{ pageSize: 10 }}
      scroll={{ x: 'max-content' }}
    />
  );
}
