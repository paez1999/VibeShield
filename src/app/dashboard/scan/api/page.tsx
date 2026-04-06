'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { ScanForm } from '@/components/scan/scan-form'
import { ScanResults } from '@/components/scan/scan-results'

export default function ApiScanPage() {
  const [result, setResult] = useState<any>(null)

  return (
    <div className="max-w-[900px] animate-fade-in">
      <PageHeader subtitle="SCANNER" title="API scan" />
      <ScanForm mode="api" onResult={setResult} />
      {result && <ScanResults result={result} />}
    </div>
  )
}
