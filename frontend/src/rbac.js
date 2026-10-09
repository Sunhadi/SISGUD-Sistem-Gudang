/** Matriks hak akses tulis (sesuai blueprint bagian 5).
 *  Bila role tidak ada di daftar → hanya bisa lihat (read-only). */
export const WRITE = {
  users: ['admin'],
  master: ['admin', 'supervisor'],
  inbound: ['admin', 'supervisor', 'operator_inbound'],
  inventory: ['admin', 'supervisor'],
  outbound: ['admin', 'supervisor', 'operator_outbound'],
  opname: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound'],
};

export const canWrite = (module, role) => (WRITE[module] || []).includes(role);

/** Role yang bisa membuka halaman (viewer tidak bisa opname) */
export const PAGE_ROLES = {
  users: ['admin'],
  items: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'],
  locations: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'],
  parties: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'],
  inbound: ['admin', 'supervisor', 'operator_inbound', 'viewer'],
  inventory: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'],
  opname: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound'],
  outbound: ['admin', 'supervisor', 'operator_outbound', 'viewer'],
  reports: ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'],
};

export const ROLE_LABELS = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  operator_inbound: 'Operator Inbound',
  operator_outbound: 'Operator Outbound',
  viewer: 'Viewer',
};
