import { EmptyState } from '../components/feedback/EmptyState';

export function NotFound() {
  return <EmptyState title="Page Not Found" description="The page you are looking for does not exist." actionLabel="Back to Home" actionTo="/" />;
}
