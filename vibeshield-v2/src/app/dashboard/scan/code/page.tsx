'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { ScanForm } from '@/components/scan/scan-form'
import { ScanResults } from '@/components/scan/scan-results'
import { QuickTextScan } from '@/components/scan/quick-text-scan'

export default function CodeScanPage() {
  const [result, setResult] = useState<any>(null)

  return (
    <div className="max-w-[900px] animate-fade-in">
      <PageHeader subtitle="SCANNER" title="Code scan" />
      <ScanForm mode="code" onResult={setResult} />
      <QuickTextScan />
      {result && <ScanResults result={result} />}
    </div>
  )
}
