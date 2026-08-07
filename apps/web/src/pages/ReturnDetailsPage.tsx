import { useParams } from 'react-router-dom';

export function ReturnDetailsPage() {
  // React escapes this when rendered as text content below, so an
  // arbitrary URL value here is never an injection risk.
  const { returnId } = useParams<{ returnId: string }>();

  return (
    <section>
      <h1>Return details</h1>
      <p>Details for return {returnId} arrive in Phase 6B2.</p>
    </section>
  );
}
