import { retiredMaintenanceEndpoint } from '@/lib/retired-maintenance';

// Schema maintenance runs from reviewed migration files, never a public HTTP request.
export const GET = retiredMaintenanceEndpoint;
