import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCall } from './firebase';
import type { AdminRequest } from './adminContract';
export const time = (ms?: number | null) => ms ? new Date(ms).toLocaleString(undefined, { timeZoneName: 'short' }) : '—';
export const tierLabel = (type: string) => type === 'epic' ? 'Legendary' : type.charAt(0).toUpperCase() + type.slice(1);
export function useAdminQuery(request: Partial<AdminRequest> & Pick<AdminRequest, 'action'>, interval?: number, enabled = true) {
    return useQuery({ queryKey: ['admin', request], queryFn: () => adminCall(request), refetchInterval: interval, refetchIntervalInBackground: false, retry: false, enabled });
}
export function useAdminMutation(eventId?: string) {
    const client = useQueryClient();
    return useMutation({ mutationFn: (request: Partial<AdminRequest> & Pick<AdminRequest, 'action'>) => adminCall({ eventId, ...request }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }), retry: false });
}
export function Notice({ error }: {
    error?: Error | null;
}) { return error ? <div className="notice error" role="alert">{error.message}</div> : null; }
export function PageTitle({ title, description, children }: {
    title: string;
    description: string;
    children?: ReactNode;
}) {
    return <div className="page-title"><div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}
export function Badge({ value }: {
    value: string;
}) { return <span className={`badge ${value}`}>{value}</span>; }
export function Freshness({ query }: {
    query: {
        isFetching: boolean;
        isError: boolean;
        dataUpdatedAt: number;
        refetch: () => unknown;
    };
}) {
    return <div className="freshness"><span className={query.isError ? 'stale' : 'live-dot'}/>{query.isError ? 'Stale data' : query.isFetching ? 'Updating…' : 'Updated'} {time(query.dataUpdatedAt)} <button onClick={() => query.refetch()}>Refresh</button></div>;
}
export function Empty({ children }: {
    children: ReactNode;
}) { return <div className="empty">{children}</div>; }
