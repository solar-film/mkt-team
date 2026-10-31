import { Suspense } from 'react';
import MarketView from './MarketView';

export default function Page() {
  return <Suspense fallback={<div className="loading-container"><div className="loading-spinner" /></div>}><MarketView mode="overview" /></Suspense>;
}