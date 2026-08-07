import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link to="/dashboard">Return to Dashboard</Link>
    </section>
  );
}
