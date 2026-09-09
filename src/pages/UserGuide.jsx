import React from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { guideSections, guideRoles, orderSetupSteps, flowWalkthroughs } from "@/lib/userGuideContent";
import GuideSection from "@/components/guide/GuideSection";
import OrderSetupGuide from "@/components/guide/OrderSetupGuide";
import FlowWalkthrough from "@/components/guide/FlowWalkthrough";

export default function UserGuide() {
  return (
    <div className="max-w-4xl mx-auto">
      <style>{`
        @media print {
          aside, nav, header, .no-print { display: none !important; }
          main, body, #root { background: #fff !important; }
          .print-page { padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold">User Guide</h1>
          <p className="text-sm text-muted-foreground">A complete printable manual for the MeatTrace system.</p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </Button>
      </div>

      <div className="print-page bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-8">
          <h1 className="text-2xl font-bold tracking-tight">MeatTrace ERP — Operating Manual</h1>
          <p className="text-sm text-slate-600 mt-1">Mitty's Foods — Production, Inventory & Traceability System</p>
        </div>

        <section className="break-inside-avoid mb-8">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-2">Who Sees What</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-300">
                <th className="py-1.5 pr-4 font-semibold w-1/3">Role</th>
                <th className="py-1.5 font-semibold">Access</th>
              </tr>
            </thead>
            <tbody>
              {guideRoles.map((r) => (
                <tr key={r.role} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-4 font-medium">{r.role}</td>
                  <td className="py-1.5 text-slate-700">{r.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {guideSections.map((section) => (
          <React.Fragment key={section.id}>
            <GuideSection section={section} />
            {section.id === "production" && (
              <>
                <section className="break-inside-avoid mb-8">
                  <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
                    5a. Setting Up a Production Order, Step by Step
                  </h2>
                  <OrderSetupGuide blocks={orderSetupSteps} />
                </section>

                <section className="mb-8">
                  <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
                    5b. What Should Happen at Each Stage, by Flow
                  </h2>
                  <p className="text-sm text-slate-700 mb-4">
                    Every product follows the flow built for it in Flow Builder. Below is what an operator is expected to
                    record and confirm at each step of each flow the plant runs.
                  </p>
                  {flowWalkthroughs.map((flow) => (
                    <FlowWalkthrough key={flow.name} flow={flow} />
                  ))}
                </section>
              </>
            )}
          </React.Fragment>
        ))}

        <div className="border-t border-slate-300 pt-3 mt-8 text-xs text-slate-500 text-center">
          MeatTrace ERP Operating Manual — keep with plant records.
        </div>
      </div>
    </div>
  );
}