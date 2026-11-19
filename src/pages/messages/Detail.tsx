import { EmptyState } from '../../components/feedback/EmptyState';

export function MessageDetail() {
  return <EmptyState title="Conversation" description="Coming in a later prompt." actionLabel="Back to Messages" actionTo="/messages" />;
}
