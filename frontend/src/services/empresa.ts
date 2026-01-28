import { api } from './api';
import { Empresa, EmpresaUpdate } from '@/types/empresa';

// Get current user's company
export async function getMyEmpresa(): Promise<Empresa> {
  const res = await api.get<Empresa>('/api/companies/me/');
  return res.data;
}

// Update current user's company
export async function updateMyEmpresa(
  empresa: EmpresaUpdate
): Promise<Empresa> {
  const res = await api.patch<Empresa>('/api/companies/me/', empresa);
  return res.data;
}
