import { Suspense } from 'react';
import ContactsView from './ContactsView';

export default function Page() {
  return <Suspense fallback={<div className="loading-container"><div className="loading-spinner" /></div>}><ContactsView mode="overview" /></Suspense>;
}
